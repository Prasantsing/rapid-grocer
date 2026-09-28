const env = require('../config/env');

function notFound(req, _res, next) {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, _req, res, _next) {
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
