require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function required(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    throw new Error(`${name} is required in production`);
  }
  return devFallback;
}

const clientOrigin = process.env.CLIENT_ORIGIN
  || 'http://127.0.0.1:43121,http://localhost:43121';

const env = {
  isProd,
  isTest,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 43110),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zapbasket',
  useMemoryMongo: process.env.USE_MEMORY_MONGO === 'true' || isTest,
  seedOnBoot: process.env.SEED_ON_BOOT
    ? process.env.SEED_ON_BOOT === 'true'
    : !isProd && !isTest,
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-only-access-secret-change-me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  clientOrigins: clientOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
};

module.exports = env;
