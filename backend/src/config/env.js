const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

if (process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY' || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('MY_'))) {
  // If it's the container placeholder, try to read the real key from .env
  const fs = require('fs');
  const envFile = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envFile)) {
    const match = fs.readFileSync(envFile, 'utf8').match(/GEMINI_API_KEY=([^\r\n]+)/);
    if (match && match[1] && !match[1].startsWith('MY_')) {
      process.env.GEMINI_API_KEY = match[1].trim();
    }
  }
}

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function required(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    console.warn(`[Config Notice] ${name} not set in environment, using default fallback.`);
  }
  return devFallback;
}

const defaultOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:43121',
  'http://127.0.0.1:43121',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'capacitor://localhost',
  'http://localhost',
];

const customOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const combinedOrigins = Array.from(new Set([...defaultOrigins, ...customOrigins]));

const defaultAppPort = 3000;
const rawPort = process.env.APP_PORT || process.env.PORT;
const resolvedPort = (rawPort && String(rawPort).trim() !== '8080')
  ? parseInt(rawPort, 10)
  : defaultAppPort;

const defaultAtlasUri = 'mongodb+srv://prasantsinghsknscoecomp_db_user:N7FJLnnnkhTzUdIt@prasant.kfrkp3c.mongodb.net/zapbasket?retryWrites=true&w=majority';
const resolvedMongoUri = (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('127.0.0.1'))
  ? process.env.MONGODB_URI
  : defaultAtlasUri;

const env = {
  isProd,
  isTest,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: resolvedPort,
  appDomain: process.env.APP_DOMAIN || `localhost:${resolvedPort}`,
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${resolvedPort}/api/v1`,
  mongoUri: resolvedMongoUri,
  useMemoryMongo: process.env.USE_MEMORY_MONGO === 'true',
  seedOnBoot: process.env.SEED_ON_BOOT !== undefined
    ? process.env.SEED_ON_BOOT === 'true'
    : !isTest,
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-only-access-secret-change-me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  clientOrigins: combinedOrigins,
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
};

module.exports = env;
