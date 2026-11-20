const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('./config');
const { migrate, getVersion } = require('./migrations');

/*
 * SQLite via sql.js (SQLite compiled to WebAssembly).
 * Chosen over native drivers so `npm install` never needs a compiler or
 * prebuilt binaries — it works the same on Windows, macOS and Linux.
 *
 * The small wrapper below exposes a better-sqlite3-style API
 * (prepare().get/all/run, exec, close) so the routes stay driver-agnostic,
 * and persists the database to disk after writes (debounced, atomic).
 */

const SAVE_DEBOUNCE_MS = 150;

class Database {
  constructor(sqlDb, filePath) {
    this.raw = sqlDb;
    this.filePath = filePath; // null => in-memory only
    this.saveTimer = null;
    this.raw.run('PRAGMA foreign_keys = ON;');
  }

  exec(sql) {
    this.raw.exec(sql);
    this.markDirty();
  }

  prepare(sql) {
    const db = this;
    const withStatement = (params, fn) => {
      const stmt = db.raw.prepare(sql);
      try {
        stmt.bind(params);
        return fn(stmt);
      } finally {
        stmt.free();
      }
    };

    return {
      get: (...params) => withStatement(params, (s) => (s.step() ? s.getAsObject() : undefined)),
      all: (...params) =>
        withStatement(params, (s) => {
          const rows = [];
          while (s.step()) rows.push(s.getAsObject());
          return rows;
        }),
      run: (...params) =>
        withStatement(params, (s) => {
          s.step();
          // Read these immediately, before any other statement runs on the connection.
          const changes = db.raw.getRowsModified();
          const lastInsertRowid = db.raw.exec('SELECT last_insert_rowid()')[0].values[0][0];
          db.markDirty();
          return { changes, lastInsertRowid };
        }),
    };
  }

  userVersion() {
    return getVersion(this.raw);
  }

  markDirty() {
    if (!this.filePath || this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS);
    this.saveTimer.unref?.();
  }

  // Atomic write: temp file + rename, so a crash never leaves a corrupt database.
  save() {
    if (!this.filePath) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const data = Buffer.from(this.raw.export());
    // export() resets connection-level pragmas, so re-apply them.
    this.raw.run('PRAGMA foreign_keys = ON;');
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, this.filePath);
  }

  close() {
    this.save();
    this.raw.close();
  }
}

async function openDatabase(dbPath = config.dbPath) {
  const SQL = await initSqlJs();

  let filePath = null;
  let existing;
  if (dbPath !== ':memory:') {
    filePath = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) existing = fs.readFileSync(filePath);
  }

  const db = new Database(existing ? new SQL.Database(existing) : new SQL.Database(), filePath);
  migrate(db.raw);
  db.save();
  return db;
}

module.exports = { openDatabase };
