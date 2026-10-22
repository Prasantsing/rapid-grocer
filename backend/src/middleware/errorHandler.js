const env = require('../config/env');

function notFound(req, _res, next) {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, req, res, _next) {
  if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (err.message && (err.message.includes('buffering timed out') || err.message.includes('topology was destroyed') || err.message.includes('ECONNREFUSED')))) {
    console.warn('[AI Studio] Database connection error caught in middleware:', err.message);
    const inMemoryStore = require('../services/inMemoryStore');

    if (req.method === 'GET') {
      if (req.path.includes('/categories')) {
        return res.json({ success: true, data: inMemoryStore.listCategories() });
      }
      if (req.path.includes('/products')) {
        return res.json({ success: true, data: inMemoryStore.searchProducts() });
      }
      return res.json({
        success: true,
        data: req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {},
      });
    }

    return res.status(503).json({
      success: false,
      message: 'Database connection offline. Connect MongoDB Atlas by setting MONGODB_URI in Cloud Run environment variables, or use demo accounts (admin@zapbasket.dev / Admin@12345).',
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'That value is already in use' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid identifier' });
  }

  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);

  const message = status >= 500 && env.isProd ? 'Internal server error' : err.message;
  const payload = { success: false, message };
  if (err.errors) payload.errors = err.errors;
  return res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
