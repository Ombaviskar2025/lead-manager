const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp(db) {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes(db));
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
