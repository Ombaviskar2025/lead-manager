const express = require('express');
const bcrypt = require('bcryptjs');
const { validateSignup, validateLogin } = require('../utils/validation');
const { badRequest, unauthorized, conflict, asyncHandler } = require('../utils/errors');
const { requireAuth, signToken } = require('../middleware/auth');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

module.exports = function authRoutes(db) {
  const router = express.Router();

  router.post('/signup', asyncHandler(async (req, res) => {
    const { errors, data } = validateSignup(req.body);
    if (Object.keys(errors).length) throw badRequest('Validation failed', errors);

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existing) throw conflict('Validation failed', { email: 'An account with this email already exists' });

    const hash = await bcrypt.hash(data.password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(data.name, data.email, hash);

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ user: publicUser(user), token: signToken(user.id) });
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const { errors, data } = validateLogin(req.body);
    if (Object.keys(errors).length) throw badRequest('Validation failed', errors);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
    const ok = user && (await bcrypt.compare(data.password, user.password_hash));
    if (!ok) throw unauthorized('Invalid email or password');

    res.json({ user: publicUser(user), token: signToken(user.id) });
  }));

  router.get('/me', requireAuth, (req, res) => {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw unauthorized('Account no longer exists');
    res.json({ user: publicUser(user) });
  });

  return router;
};
