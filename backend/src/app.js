const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const routes = require('./routes');
const { swaggerSpec } = require('./config/swagger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const clientDistCandidates = [
  path.resolve(__dirname, '../../frontend/dist/frontend/browser'),
  path.resolve(__dirname, '../../frontend/dist/frontend'),
];
const clientDist = clientDistCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || clientDistCandidates[0];

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin.includes('.run.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      env.clientOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(morgan(env.isTest ? 'tiny' : env.isProd ? 'combined' : 'dev', {
  skip: () => env.isTest,
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Mount static directory candidates
clientDistCandidates.forEach((dir) => {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir, {
      maxAge: 0,
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (/\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(filePath)) {
          // Versioned chunks or static assets
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
          }
        }
      },
    }));
  }
});

app.get('/api', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'ZapBasket API',
      docs: '/api/docs',
      health: '/api/v1/health',
    },
  });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'ZapBasket API' }));
app.get('/api/openapi.json', (_req, res) => res.json(swaggerSpec));
app.use('/api/v1', routes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  // Detect requests for static files or chunks
  const isChunkOrAsset =
    req.path.includes('chunk-') ||
    /\.(js|mjs|css|map|png|jpg|jpeg|svg|webp|ico|json|woff2?|ttf|webmanifest)$/i.test(req.path);

  if (isChunkOrAsset) {
    // Check if the requested file exists in any of the distribution directories
    for (const dir of clientDistCandidates) {
      const filePath = path.join(dir, req.path);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
        return res.sendFile(filePath);
      }
    }
    // Static asset missing: return 404 plain text so browser dynamic imports fail cleanly
    // instead of receiving HTML and throwing SyntaxError/TypeError
    return res.status(404).type('text/plain').send('Asset not found');
  }

  // SPA client-side route fallback to index.html
  const candidateWithIndex = clientDistCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
  if (candidateWithIndex) {
    const indexPath = path.join(candidateWithIndex, 'index.html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(indexPath);
  }

  if (req.path === '/') {
    return res.json({
      success: true,
      data: {
        name: 'ZapBasket API',
        docs: '/api/docs',
        health: '/api/v1/health',
      },
    });
  }
  next();
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
