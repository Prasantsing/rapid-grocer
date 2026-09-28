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

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.clientOrigins, credentials: true }));
app.use(compression());
app.use(morgan(env.isTest ? 'tiny' : env.isProd ? 'combined' : 'dev', {
  skip: () => env.isTest,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/', (_req, res) => {
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
app.use(notFound);
app.use(errorHandler);

module.exports = app;
