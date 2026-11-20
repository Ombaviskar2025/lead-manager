const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { lead, auth, makeApp, signup } = require('./helpers');

let app;
let token;

before(async () => {
  ({ app } = await makeApp());
  token = await signup(app);
});

const create = (over) => request(app).post('/api/leads').set(auth(token)).send(lead(over));

test('update rejects every kind of invalid payload with field-level errors', async () => {
  const { body } = await create();
  const cases = [
    [{ name: '' }, 'name'],
    [{ name: 'x'.repeat(101) }, 'name'],
    [{ email: 'not-an-email' }, 'email'],
    [{ email: 'a@b' }, 'email'],
    [{ phone: '12' }, 'phone'],
    [{ phone: 'call me maybe' }, 'phone'],
    [{ company: '   ' }, 'company'],
    [{ source: 'Carrier Pigeon' }, 'source'],
    [{ status: 'Won' }, 'status'],
  ];
  for (const [over, field] of cases) {
    const res = await request(app).put(`/api/leads/${body.id}`).set(auth(token)).send(lead(over));
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(over)}`);
    assert.ok(res.body.details[field], `expected error on ${field}`);
  }
  // the lead is unchanged after all the rejected updates
  const after = await request(app).get(`/api/leads/${body.id}`).set(auth(token));
  assert.equal(after.body.name, 'Jane Doe');
});

test('update of a missing or malformed id fails cleanly', async () => {
  assert.equal((await request(app).put('/api/leads/99999').set(auth(token)).send(lead())).status, 404);
  assert.equal((await request(app).put('/api/leads/abc').set(auth(token)).send(lead())).status, 400);
  assert.equal((await request(app).put('/api/leads/-5').set(auth(token)).send(lead())).status, 400);
  assert.equal((await request(app).put('/api/leads/1.5').set(auth(token)).send(lead())).status, 400);
});

test('update changes status and bumps updated_at while keeping created_at', async () => {
  const { body } = await create({ email: 'ts@example.com' });
  const res = await request(app).put(`/api/leads/${body.id}`).set(auth(token)).send(lead({ email: 'ts@example.com', status: 'Lost' }));
  assert.equal(res.body.status, 'Lost');
  assert.equal(res.body.created_at, body.created_at);
  assert.ok(res.body.updated_at >= body.updated_at);
});

test('input is trimmed and email is lower-cased before saving', async () => {
  const res = await create({ name: '  Padded Name  ', email: '  MiXed@Example.COM ', company: ' Co ' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'Padded Name');
  assert.equal(res.body.email, 'mixed@example.com');
  assert.equal(res.body.company, 'Co');
});

test('missing status defaults to New; non-string values are rejected not crashed on', async () => {
  const { status: _omit, ...noStatus } = lead({ email: 'nostatus@example.com' });
  const res = await request(app).post('/api/leads').set(auth(token)).send(noStatus);
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'New');

  const weird = await request(app).post('/api/leads').set(auth(token)).send({ name: 123, email: ['a'], phone: {}, company: null, source: true });
  assert.equal(weird.status, 400);
  const empty = await request(app).post('/api/leads').set(auth(token)).send({});
  assert.equal(empty.status, 400);
});

test('names with quotes and SQL metacharacters are stored literally (no injection)', async () => {
  const nasty = `Robert'); DROP TABLE leads;--`;
  const res = await create({ name: nasty, email: 'bobby@example.com' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, nasty);
  const list = await request(app).get('/api/leads').set(auth(token));
  assert.ok(list.body.pagination.total > 0, 'table still exists');
  const found = await request(app).get('/api/leads').query({ q: "'); DROP" }).set(auth(token));
  assert.equal(found.status, 200);
  assert.equal(found.body.items.length, 1);
});

test('pagination clamps bad values and handles pages past the end', async () => {
  const clamp = await request(app).get('/api/leads?limit=100000&page=-3').set(auth(token));
  assert.equal(clamp.body.pagination.limit, 100);
  assert.equal(clamp.body.pagination.page, 1);

  const garbage = await request(app).get('/api/leads?limit=abc&page=xyz').set(auth(token));
  assert.equal(garbage.status, 200);
  assert.equal(garbage.body.pagination.limit, 10);

  const beyond = await request(app).get('/api/leads?page=999').set(auth(token));
  assert.equal(beyond.status, 200);
  assert.equal(beyond.body.items.length, 0);
});

test('search + status filter combine, and search is case-insensitive', async () => {
  await create({ name: 'Zelda Zorn', email: 'zelda@example.com', status: 'Qualified', company: 'Hyrule' });
  const both = await request(app).get('/api/leads').query({ q: 'ZELDA', status: 'Qualified' }).set(auth(token));
  assert.equal(both.body.items.length, 1);
  const mismatch = await request(app).get('/api/leads').query({ q: 'zelda', status: 'Lost' }).set(auth(token));
  assert.equal(mismatch.body.items.length, 0);
  const byCompany = await request(app).get('/api/leads').query({ q: 'hyrule' }).set(auth(token));
  assert.equal(byCompany.body.items.length, 1);
});

test('stats always report all four statuses, even with zero leads', async () => {
  const { app: fresh } = await makeApp();
  const t = await signup(fresh, 'empty@example.com');
  const res = await request(fresh).get('/api/leads/stats').set(auth(t));
  assert.deepEqual(res.body, { total: 0, byStatus: { New: 0, Contacted: 0, Qualified: 0, Lost: 0 } });
});

test('oversized request bodies are rejected', async () => {
  const res = await request(app).post('/api/leads').set(auth(token)).send(lead({ name: 'x'.repeat(200_000) }));
  assert.equal(res.status, 413);
});
