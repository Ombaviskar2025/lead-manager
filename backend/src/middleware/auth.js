const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized } = require('../utils/errors');

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

module.exports = { requireAuth, signToken };
