const config = require('./config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

async function main() {
  config.assertProductionSafe();

  const db = await openDatabase();
  const app = createApp(db);

  const server = app.listen(config.port, () => {
    console.log(`Lead Manager API listening on http://localhost:${config.port}`);
  });

  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${config.port} is already in use. Set PORT in backend/.env.` : err);
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => {
      db.close(); // flushes any pending write to disk
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
