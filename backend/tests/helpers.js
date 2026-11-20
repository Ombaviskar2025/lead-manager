const request = require('supertest');
const { openDatabase } = require('../src/db');
const { createApp } = require('../src/app');

const lead = (over = {}) => ({
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+91 98765 43210',
  company: 'Acme Inc',
  source: 'Website',
  status: 'New',
  ...over,
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function makeApp(options) {
  const db = await openDatabase(':memory:');
  return { db, app: createApp(db, options) };
}

async function signup(app, email = 'user@example.com', name = 'Test User') {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123' });
  return res.body.token;
}

module.exports = { lead, auth, makeApp, signup };
