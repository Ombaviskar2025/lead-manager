#!/usr/bin/env node
/*
 * Copies the SQLite database to backups/leads-<timestamp>.db and prunes old copies.
 *   npm run backup                 -> backs up DB_PATH (default data/leads.db)
 *   npm run backup -- --keep 14    -> keep the 14 newest backups (default 10)
 *
 * Safe to run while the server is up: the server always replaces the database file
 * atomically (write temp file + rename), so a copy is never half-written.
 * Restore: stop the server, copy a backup over DB_PATH, start the server.
 */
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

const keepIdx = process.argv.indexOf('--keep');
const keep = keepIdx > -1 ? Math.max(1, Number(process.argv[keepIdx + 1]) || 10) : 10;

const source = path.resolve(config.dbPath);
if (!fs.existsSync(source)) {
  console.error(`No database found at ${source}`);
  process.exit(1);
}

const dir = path.join(path.dirname(source), 'backups');
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(dir, `leads-${stamp}.db`);
fs.copyFileSync(source, target);
console.log(`Backup written: ${target}`);

const old = fs.readdirSync(dir).filter((f) => /^leads-.*\.db$/.test(f)).sort().reverse().slice(keep);
old.forEach((f) => fs.unlinkSync(path.join(dir, f)));
if (old.length) console.log(`Pruned ${old.length} old backup(s).`);
