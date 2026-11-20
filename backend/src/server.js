const config = require('./config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

if (config.nodeEnv === 'production' && config.jwtSecret === 'dev-only-secret-change-me') {
  console.error('Refusing to start: set JWT_SECRET in production.');
  process.exit(1);
}

const db = openDatabase();
const app = createApp(db);

const server = app.listen(config.port, () => {
  console.log(`Lead Manager API listening on http://localhost:${config.port}`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
