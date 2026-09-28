const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(payload) {
  return jwt.sign({ ...payload, type: 'access', jti: crypto.randomUUID() }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });
}

function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh', jti: crypto.randomUUID() }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwt.accessSecret);
  if (payload.type !== 'access') {
    const error = new Error('Invalid token type');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.jwt.refreshSecret);
  if (payload.type !== 'refresh') {
    const error = new Error('Invalid token type');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return payload;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
