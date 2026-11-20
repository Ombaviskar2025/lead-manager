const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized } = require('../utils/errors');

const COOKIE_NAME = 'lm_session';

const cookieOptions = () => ({
  httpOnly: true, // not readable from JavaScript, so XSS cannot steal the session
  secure: config.cookieSecure,
  sameSite: config.cookieSameSite,
  path: '/',
});

function readToken(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  // Bearer header is still accepted for API clients (curl, tests, mobile apps)
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(unauthorized('Invalid or expired session'));
  }
}

// Like requireAuth, but an anonymous or invalid session just continues with no req.user.
function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try { req.user = { id: jwt.verify(token, config.jwtSecret).sub }; } catch { /* treat as signed out */ }
  }
  next();
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: config.cookieMaxAgeMs });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

module.exports = { requireAuth, optionalAuth, signToken, setSessionCookie, clearSessionCookie, COOKIE_NAME };
