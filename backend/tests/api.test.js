const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { openDatabase } = require('../src/db');
const { createApp } = require('../src/app');

let app;
let tokenA;
let tokenB;

const lead = (over = {}) => ({
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+91 98765 43210',
  company: 'Acme Inc',
  source: 'Website',
  status: 'New',
  ...over,
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  app = createApp(openDatabase(':memory:'));
  const a = await request(app).post('/api/auth/signup').send({ name: 'Alice', email: 'alice@example.com', password: 'password123' });
  const b = await request(app).post('/api/auth/signup').send({ name: 'Bob', email: 'bob@example.com', password: 'password123' });
  tokenA = a.body.token;
  tokenB = b.body.token;
});

test('health check', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
});

test('signup validates input and rejects duplicates', async () => {
  const bad = await request(app).post('/api/auth/signup').send({ name: '', email: 'nope', password: '123' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.details.email && bad.body.details.password && bad.body.details.name);

  const dup = await request(app).post('/api/auth/signup').send({ name: 'A', email: 'ALICE@example.com', password: 'password123' });
  assert.equal(dup.status, 409);
});

test('login succeeds and fails appropriately', async () => {
  const ok = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'password123' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  const bad = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'wrongpass' });
  assert.equal(bad.status, 401);
});

test('leads require authentication', async () => {
  assert.equal((await request(app).get('/api/leads')).status, 401);
  assert.equal((await request(app).get('/api/leads').set(auth('garbage'))).status, 401);
});

test('create lead validates required fields, email and enums', async () => {
  const res = await request(app).post('/api/leads').set(auth(tokenA)).send({ name: '', email: 'bad', phone: 'abc', company: '', source: 'Nope', status: 'Weird' });
  assert.equal(res.status, 400);
  for (const f of ['name', 'email', 'phone', 'company', 'source', 'status']) assert.ok(res.body.details[f], `missing error for ${f}`);
});

test('full CRUD flow', async () => {
  const created = await request(app).post('/api/leads').set(auth(tokenA)).send(lead());
  assert.equal(created.status, 201);
  assert.equal(created.body.status, 'New');
  const id = created.body.id;

  const got = await request(app).get(`/api/leads/${id}`).set(auth(tokenA));
  assert.equal(got.status, 200);
  assert.equal(got.body.email, 'jane@example.com');

  const updated = await request(app).put(`/api/leads/${id}`).set(auth(tokenA)).send(lead({ status: 'Qualified' }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, 'Qualified');

  const del = await request(app).delete(`/api/leads/${id}`).set(auth(tokenA));
  assert.equal(del.status, 204);
  assert.equal((await request(app).get(`/api/leads/${id}`).set(auth(tokenA))).status, 404);
  assert.equal((await request(app).delete(`/api/leads/${id}`).set(auth(tokenA))).status, 404);
});

test('users only see and modify their own leads', async () => {
  const created = await request(app).post('/api/leads').set(auth(tokenA)).send(lead({ name: 'Private Lead', email: 'private@example.com' }));
  const id = created.body.id;

  const listB = await request(app).get('/api/leads?q=Private').set(auth(tokenB));
  assert.equal(listB.body.items.length, 0);
  assert.equal((await request(app).get(`/api/leads/${id}`).set(auth(tokenB))).status, 404);
  assert.equal((await request(app).put(`/api/leads/${id}`).set(auth(tokenB)).send(lead())).status, 404);
  assert.equal((await request(app).delete(`/api/leads/${id}`).set(auth(tokenB))).status, 404);
});

test('search, status filter, sorting, pagination and stats', async () => {
  const seed = [
    ['Zed Zimmer', 'Contacted'],
    ['Amy Adams', 'Qualified'],
    ['Bob Brown', 'Lost'],
    ['Carl Clark', 'Contacted'],
  ];
  for (const [i, [name, status]] of seed.entries()) {
    const r = await request(app).post('/api/leads').set(auth(tokenB)).send(lead({ name, status, email: `seed${i}@example.com` }));
    assert.equal(r.status, 201);
  }

  const search = await request(app).get('/api/leads?q=amy').set(auth(tokenB));
  assert.equal(search.body.items.length, 1);
  assert.equal(search.body.items[0].name, 'Amy Adams');

  const filtered = await request(app).get('/api/leads?status=Contacted').set(auth(tokenB));
  assert.equal(filtered.body.pagination.total, 2);

  const sorted = await request(app).get('/api/leads?sortBy=name&order=asc').set(auth(tokenB));
  assert.equal(sorted.body.items[0].name, 'Amy Adams');

  const paged = await request(app).get('/api/leads?limit=2&page=2&sortBy=name&order=asc').set(auth(tokenB));
  assert.equal(paged.body.items.length, 2);
  assert.equal(paged.body.pagination.totalPages, 2);

  const stats = await request(app).get('/api/leads/stats').set(auth(tokenB));
  assert.equal(stats.body.byStatus.Contacted, 2);
  assert.equal(stats.body.byStatus.Qualified, 1);
  assert.equal(stats.body.byStatus.Lost, 1);
  assert.equal(stats.body.total, 4);

  assert.equal((await request(app).get('/api/leads?status=Bogus').set(auth(tokenB))).status, 400);
  assert.equal((await request(app).get('/api/leads?sortBy=password_hash').set(auth(tokenB))).status, 400);
});

test('search treats wildcards literally', async () => {
  const res = await request(app).get('/api/leads?q=%25').set(auth(tokenB));
  assert.equal(res.body.items.length, 0);
});

test('malformed JSON and unknown routes return clean errors', async () => {
  const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
  assert.equal(bad.status, 400);
  assert.equal((await request(app).get('/api/nope')).status, 404);
  assert.equal((await request(app).get('/api/leads/abc').set(auth(tokenA))).status, 400);
});
