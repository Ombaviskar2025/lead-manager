#!/usr/bin/env node
/*
 * Creates a demo account with sample leads so a reviewer can explore immediately.
 *   npm run seed            (from backend/)  or  npm run seed --prefix backend
 * Login: demo@example.com / demo12345. Safe to run repeatedly (skips if the account exists).
 */
const bcrypt = require('bcryptjs');
const { openDatabase } = require('../src/db');

const SAMPLE = [
  ['Priya Sharma', 'priya@acme.com', '+91 98765 43210', 'Acme Inc', 'Referral', 'Qualified'],
  ['Rahul Verma', 'rahul@globex.com', '+91 91234 56789', 'Globex', 'LinkedIn', 'Contacted'],
  ['Sara Khan', 'sara@initech.com', '+91 99887 76655', 'Initech', 'Website', 'New'],
  ['Vikram Rao', 'vikram@umbrella.io', '+91 90000 11122', 'Umbrella', 'Event', 'Lost'],
  ['Ananya Iyer', 'ananya@hooli.com', '+91 98450 12345', 'Hooli', 'Email Campaign', 'New'],
  ['Arjun Mehta', 'arjun@piedpiper.com', '+91 97000 23456', 'Pied Piper', 'Cold Call', 'Contacted'],
  ['Neha Gupta', 'neha@stark.in', '+91 98111 22233', 'Stark Industries', 'Website', 'Qualified'],
  ['Karan Singh', 'karan@wayne.co', '+91 98222 33344', 'Wayne Enterprises', 'Referral', 'New'],
  ['Meera Nair', 'meera@wonka.com', '+91 98333 44455', 'Wonka Foods', 'LinkedIn', 'Contacted'],
  ['Rohit Das', 'rohit@cyberdyne.ai', '+91 98444 55566', 'Cyberdyne', 'Other', 'Lost'],
  ['Isha Patel', 'isha@soylent.com', '+91 98555 66677', 'Soylent', 'Event', 'Qualified'],
  ['Dev Malhotra', 'dev@vandelay.com', '+91 98666 77788', 'Vandelay Industries', 'Website', 'New'],
];

(async () => {
  const db = await openDatabase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get('demo@example.com')) {
    console.log('Demo account already exists - nothing to do.');
    db.close();
    return;
  }
  const hash = await bcrypt.hash('demo12345', 10);
  const uid = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('Demo User', 'demo@example.com', hash).lastInsertRowid;
  const insert = db.prepare('INSERT INTO leads (user_id, name, email, phone, company, source, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  SAMPLE.forEach((row) => insert.run(uid, ...row));
  db.close();
  console.log(`Seeded demo account (demo@example.com / demo12345) with ${SAMPLE.length} leads.`);
})().catch((e) => { console.error(e); process.exit(1); });
