const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { validateSignup, validateLogin } = require('../utils/validation');
const { badRequest, unauthorized, conflict, asyncHandler } = require('../utils/errors');
const { requireAuth, optionalAuth, signToken, setSessionCookie, clearSessionCookie } = require('../middleware/auth');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

module.exports = function authRoutes(db, options = {}) {
  const router = express.Router();

  // Brute-force protection for credential endpoints only
  const limiter = rateLimit({
    windowMs: options.rateLimitWindowMs ?? config.authRateLimitWindowMs,
    limit: options.rateLimitMax ?? config.authRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  });

  const startSession = (res, user, status = 200) => {
    const token = signToken(user.id);
    setSessionCookie(res, token);
    // token is also returned so non-browser API clients can use the Bearer header
    res.status(status).json({ user: publicUser(user), token });
  };

  router.post('/signup', limiter, asyncHandler(async (req, res) => {
    const { errors, data } = validateSignup(req.body);
    if (Object.keys(errors).length) throw badRequest('Validation failed', errors);

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existing) throw conflict('Validation failed', { email: 'An account with this email already exists' });

    const hash = await bcrypt.hash(data.password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(data.name, data.email, hash);

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(info.lastInsertRowid);
    startSession(res, user, 201);
  }));

  router.post('/login', limiter, asyncHandler(async (req, res) => {
    const { errors, data } = validateLogin(req.body);
    if (Object.keys(errors).length) throw badRequest('Validation failed', errors);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
    const ok = user && (await bcrypt.compare(data.password, user.password_hash));
    if (!ok) throw unauthorized('Invalid email or password');

    startSession(res, user);
  }));

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  // Used by the UI on page load. Always 200: { user } when signed in, { user: null } otherwise,
  // so a logged-out visit does not produce a failed request in the browser console.
  router.get('/session', optionalAuth, (req, res) => {
    const user = req.user ? db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id) : null;
    res.json({ user: user ? publicUser(user) : null });
  });

  router.get('/me', requireAuth, (req, res) => {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw unauthorized('Account no longer exists');
    res.json({ user: publicUser(user) });
  });

  return router;
};
