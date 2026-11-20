const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { lead, makeApp } = require('./helpers');

const creds = { name: 'Cookie User', email: 'cookie@example.com', password: 'password123' };

test('signup sets an HttpOnly session cookie that authenticates later requests', async () => {
  const { app } = await makeApp();
  const agent = request.agent(app);

  const res = await agent.post('/api/auth/signup').send(creds);
  assert.equal(res.status, 201);
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('lm_session='));
  assert.ok(cookie, 'session cookie set');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);

  assert.equal((await agent.get('/api/auth/me')).body.user.email, creds.email);
  assert.equal((await agent.post('/api/leads').send(lead())).status, 201);
});

test('logout clears the cookie and ends the session', async () => {
  const { app } = await makeApp();
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send(creds);

  const out = await agent.post('/api/auth/logout');
  assert.equal(out.status, 204);
  assert.match(out.headers['set-cookie'].join(';'), /lm_session=;/);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});

test('tampered, expired and wrongly-signed tokens are rejected', async () => {
  const { app } = await makeApp();
  const t = (await request(app).post('/api/auth/signup').send(creds)).body.token;

  const tampered = `${t.slice(0, -4)}AAAA`;
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', `lm_session=${tampered}`)).status, 401);

  const forged = jwt.sign({ sub: 1 }, 'some-other-secret');
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status, 401);

  const expired = jwt.sign({ sub: 1 }, config.jwtSecret, { expiresIn: -10 });
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`)).status, 401);
});

test('a valid token for a deleted account is rejected', async () => {
  const { app, db } = await makeApp();
  const t = (await request(app).post('/api/auth/signup').send(creds)).body.token;
  db.prepare('DELETE FROM users').run();
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`)).status, 401);
});

test('passwords are stored hashed, never in plain text', async () => {
  const { app, db } = await makeApp();
  await request(app).post('/api/auth/signup').send(creds);
  const row = db.prepare('SELECT password_hash FROM users').get();
  assert.notEqual(row.password_hash, creds.password);
  assert.match(row.password_hash, /^\$2[aby]\$/);
});

test('responses never leak the password hash', async () => {
  const { app } = await makeApp();
  const res = await request(app).post('/api/auth/signup').send(creds);
  assert.equal(JSON.stringify(res.body).includes('password'), false);
});

test('login and signup are rate limited (429 after too many attempts)', async () => {
  const { app } = await makeApp({ rateLimitMax: 3 });
  const attempt = () => request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'wrongwrong' });

  for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
  const blocked = await attempt();
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /too many/i);
});

test('rate limiting does not affect normal API usage', async () => {
  const { app } = await makeApp({ rateLimitMax: 2 });
  const t = (await request(app).post('/api/auth/signup').send(creds)).body.token;
  for (let i = 0; i < 6; i++) {
    assert.equal((await request(app).get('/api/leads').set('Authorization', `Bearer ${t}`)).status, 200);
  }
});

test('security headers are present and x-powered-by is hidden', async () => {
  const { app } = await makeApp();
  const res = await request(app).get('/api/health');
  assert.equal(res.headers['x-powered-by'], undefined);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(res.headers['content-security-policy']);
});

test('production refuses to start with a missing or weak JWT secret', () => {
  const fresh = (env) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    delete require.cache[require.resolve('../src/config')];
    try { return require('../src/config'); } finally {
      process.env = saved;
      delete require.cache[require.resolve('../src/config')];
    }
  };
  const prod = (secret) => {
    const env = { NODE_ENV: 'production' };
    if (secret) env.JWT_SECRET = secret; else delete process.env.JWT_SECRET;
    return fresh(env);
  };

  assert.throws(() => prod().assertProductionSafe(), /JWT_SECRET/);
  assert.throws(() => prod('short').assertProductionSafe(), /JWT_SECRET/);
  assert.doesNotThrow(() => prod('x'.repeat(40)).assertProductionSafe());
  assert.equal(prod('x'.repeat(40)).cookieSecure, true);
});

test('/session answers 200 with user:null when signed out, and with the user when signed in', async () => {
  const { app } = await makeApp();
  const agent = request.agent(app);

  const anon = await agent.get('/api/auth/session');
  assert.equal(anon.status, 200);
  assert.deepEqual(anon.body, { user: null });

  await agent.post('/api/auth/signup').send(creds);
  const authed = await agent.get('/api/auth/session');
  assert.equal(authed.body.user.email, creds.email);

  const bad = await request(app).get('/api/auth/session').set('Cookie', 'lm_session=garbage');
  assert.deepEqual(bad.body, { user: null });
});
