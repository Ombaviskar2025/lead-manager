require('dotenv').config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const DEV_SECRET = 'dev-only-secret-change-me';

const config = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET || DEV_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || 'data/leads.db',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // Session cookie. "lax" is right for single-origin deploys; use "none" (requires HTTPS)
  // only if the frontend is hosted on a different site than the API.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  // Set to 1 when running behind a reverse proxy (Render, Railway, Heroku, nginx...)
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0,
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
};

/** Throws if the configuration is unsafe for production. */
config.assertProductionSafe = () => {
  if (!isProd) return;
  if (config.jwtSecret === DEV_SECRET || config.jwtSecret.length < 32) {
    throw new Error('Refusing to start: set JWT_SECRET to a random string of at least 32 characters in production.');
  }
};

module.exports = config;
