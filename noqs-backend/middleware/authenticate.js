/**
 * Reads a JWT from the httpOnly cookie (web app) or the Authorization
 * Bearer header (API clients / Socket.io), verifies it, and attaches
 * req.user = { userId, role, merchantId, branchId }.
 *
 * Two variants:
 *   authenticate         → 401 if no/invalid token (hard gate)
 *   attachUserIfPresent  → never blocks; sets req.user when a valid token exists
 */

const { verifyToken } = require('../utils/auth');

function extractToken(req) {
  if (req.cookies && req.cookies.noqs_token) return req.cookies.noqs_token;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

function attachUserIfPresent(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try { req.user = verifyToken(token); } catch { /* ignore — stays anonymous */ }
  }
  next();
}

module.exports = { authenticate, attachUserIfPresent, extractToken };
