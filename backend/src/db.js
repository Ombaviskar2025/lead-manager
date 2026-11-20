const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

function openDatabase(dbPath = config.dbPath) {
  if (dbPath !== ':memory:') {
    const abs = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    dbPath = abs;
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      phone      TEXT    NOT NULL,
      company    TEXT    NOT NULL,
      source     TEXT    NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'New'
                 CHECK (status IN ('New','Contacted','Qualified','Lost')),
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_leads_user_status  ON leads(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_leads_user_created ON leads(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_leads_user_name    ON leads(user_id, name COLLATE NOCASE);
  `);

  return db;
}

module.exports = { openDatabase };
