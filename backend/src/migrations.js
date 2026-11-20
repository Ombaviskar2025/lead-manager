/*
 * Versioned schema migrations.
 *
 * The applied version is stored inside the database file itself (PRAGMA user_version),
 * so a database always knows which migrations it already has. On startup every
 * migration newer than the stored version runs, in order, each inside a transaction.
 *
 * To change the schema: append a new entry to MIGRATIONS. Never edit an existing one.
 * Statements must be safe to run on databases created by earlier releases.
 */
const MIGRATIONS = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
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
    `,
  },
];

const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

function getVersion(raw) {
  return raw.exec('PRAGMA user_version')[0].values[0][0];
}

/** Applies pending migrations to a raw sql.js database. Returns the versions applied. */
function migrate(raw) {
  const current = getVersion(raw);
  if (current > LATEST_VERSION) {
    throw new Error(`Database schema (v${current}) is newer than this app supports (v${LATEST_VERSION}). Update the app.`);
  }

  const applied = [];
  for (const m of MIGRATIONS.filter((x) => x.version > current)) {
    raw.exec('BEGIN');
    try {
      raw.exec(m.sql);
      raw.exec(`PRAGMA user_version = ${m.version}`);
      raw.exec('COMMIT');
      applied.push(m.version);
    } catch (err) {
      raw.exec('ROLLBACK');
      throw new Error(`Migration ${m.version} (${m.name}) failed: ${err.message}`);
    }
  }
  return applied;
}

module.exports = { MIGRATIONS, LATEST_VERSION, migrate, getVersion };
