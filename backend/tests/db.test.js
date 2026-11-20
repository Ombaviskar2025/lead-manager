const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { openDatabase } = require('../src/db');
const { LATEST_VERSION } = require('../src/migrations');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'leadmgr-'));
const addUser = (db, email = 'a@example.com') =>
  db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('A', email, 'hash').lastInsertRowid;
const addLead = (db, userId, name = 'Persisted') =>
  db.prepare('INSERT INTO leads (user_id, name, email, phone, company, source) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, name, 'p@example.com', '1234567', 'Co', 'Other');

test('data survives a close and reopen (persistence across restarts)', async () => {
  const file = path.join(tmpDir(), 'nested', 'leads.db'); // also proves missing folders are created
  const db1 = await openDatabase(file);
  const uid = addUser(db1);
  addLead(db1, uid);
  db1.close();

  const db2 = await openDatabase(file);
  assert.equal(db2.prepare('SELECT COUNT(*) c FROM users').get().c, 1);
  assert.equal(db2.prepare('SELECT name FROM leads').get().name, 'Persisted');
  db2.close();
});

test('writes are flushed to disk automatically without calling close()', async () => {
  const file = path.join(tmpDir(), 'leads.db');
  const db = await openDatabase(file);
  addLead(db, addUser(db));
  await new Promise((r) => setTimeout(r, 400)); // debounce window

  const copy = await openDatabase(file); // a second reader sees the data
  assert.equal(copy.prepare('SELECT COUNT(*) c FROM leads').get().c, 1);
  db.close();
});

test('no temp file is left behind after saving', async () => {
  const dir = tmpDir();
  const db = await openDatabase(path.join(dir, 'leads.db'));
  addLead(db, addUser(db));
  db.close();
  assert.deepEqual(fs.readdirSync(dir), ['leads.db']);
});

test('foreign keys stay enforced after the database has been saved', async () => {
  const db = await openDatabase(path.join(tmpDir(), 'leads.db')); // open() saves once
  assert.throws(() => addLead(db, 9999), /FOREIGN KEY/i);
  db.save();
  assert.throws(() => addLead(db, 9999), /FOREIGN KEY/i);
  db.close();
});

test('deleting a user cascades to their leads', async () => {
  const db = await openDatabase(':memory:');
  const uid = addUser(db);
  addLead(db, uid);
  db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM leads').get().c, 0);
});

test('database constraints reject bad data even if the API were bypassed', async () => {
  const db = await openDatabase(':memory:');
  const uid = addUser(db);
  assert.throws(
    () => db.prepare("INSERT INTO leads (user_id, name, email, phone, company, source, status) VALUES (?, 'n','e','p','c','s','Won')").run(uid),
    /CHECK/i
  );
  assert.throws(() => addUser(db, 'A@EXAMPLE.COM'), /UNIQUE/i); // email uniqueness is case-insensitive
});

test('migrations: new database is brought to the latest version', async () => {
  const db = await openDatabase(':memory:');
  assert.equal(db.userVersion(), LATEST_VERSION);
});

test('migrations: reopening does not re-run them or lose data', async () => {
  const file = path.join(tmpDir(), 'leads.db');
  const db1 = await openDatabase(file);
  addLead(db1, addUser(db1));
  db1.close();
  const db2 = await openDatabase(file);
  assert.equal(db2.userVersion(), LATEST_VERSION);
  assert.equal(db2.prepare('SELECT COUNT(*) c FROM leads').get().c, 1);
  db2.close();
});

test('migrations: a pre-versioning database (version 0) is upgraded in place', async () => {
  const file = path.join(tmpDir(), 'leads.db');
  const db1 = await openDatabase(file);
  addLead(db1, addUser(db1));
  db1.exec('PRAGMA user_version = 0'); // simulate a database from before migrations existed
  db1.close();

  const db2 = await openDatabase(file);
  assert.equal(db2.userVersion(), LATEST_VERSION);
  assert.equal(db2.prepare('SELECT COUNT(*) c FROM leads').get().c, 1);
  db2.close();
});

test('migrations: refuses a database from a newer version of the app', async () => {
  const file = path.join(tmpDir(), 'leads.db');
  const db1 = await openDatabase(file);
  db1.exec(`PRAGMA user_version = ${LATEST_VERSION + 5}`);
  db1.close();
  await assert.rejects(openDatabase(file), /newer than this app supports/);
});

test('backup script copies the database and prunes old backups', async () => {
  const dir = tmpDir();
  const file = path.join(dir, 'leads.db');
  const db = await openDatabase(file);
  addLead(db, addUser(db));
  db.close();

  const script = path.join(__dirname, '..', 'scripts', 'backup.js');
  const run = (args = []) => execFileSync(process.execPath, [script, ...args], { env: { ...process.env, DB_PATH: file }, encoding: 'utf8' });
  for (let i = 0; i < 3; i++) { run(['--keep', '2']); await new Promise((r) => setTimeout(r, 15)); }

  const backups = fs.readdirSync(path.join(dir, 'backups'));
  assert.equal(backups.length, 2, 'only the 2 newest are kept');

  const restored = await openDatabase(path.join(dir, 'backups', backups[0]));
  assert.equal(restored.prepare('SELECT COUNT(*) c FROM leads').get().c, 1, 'a backup is a valid, complete database');
  restored.close();
});
