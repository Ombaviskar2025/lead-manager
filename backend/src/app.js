const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * @param {object} db       database wrapper from db.js
 * @param {object} options  optional overrides (used by tests): rateLimitMax, rateLimitWindowMs
 */
function createApp(db, options = {}) {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        // Keep http://localhost usable in all browsers (Safari would otherwise upgrade to https)
        directives: { 'upgrade-insecure-requests': null },
      },
    })
  );

  // Credentials are only needed when the frontend lives on another origin
  const origins = config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim());
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes(db, options));
  app.use('/api/leads', leadRoutes(db));
  app.use('/api', notFoundHandler);

  // Serve the built frontend (single-deploy mode) when it exists
  const dist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
