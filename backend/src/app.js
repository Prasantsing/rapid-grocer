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

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    maxAge: env.isProd ? '7d' : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
}

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
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
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
