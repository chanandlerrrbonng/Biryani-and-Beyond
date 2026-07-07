/**
 * Auth utilities — password hashing + JWT signing/verification.
 * Kept dependency-light and side-effect-free (no DB, no Express) so the
 * pure functions are unit-testable, mirroring utils/billing.js.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const JWT_SECRET = process.env.JWT_SECRET || 'noqs-dev-insecure-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const JWT_ALG = 'HS256'; // pin the algorithm — never allow "none" (CVE-safe)

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw new RangeError('password must be a string of at least 8 characters');
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

/**
 * Sign a JWT for an authenticated user. Payload is deliberately minimal —
 * just what authz needs, so scoping decisions never require a DB round-trip.
 */
function signToken(user) {
  const payload = {
    userId: user.user_id ?? user.userId,
    role: user.role,
    merchantId: user.merchant_id ?? user.merchantId ?? null,
    branchId: user.branch_id ?? user.branchId ?? null
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALG, expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  // Pinning algorithms prevents the "alg: none" signature-bypass class of bugs.
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALG] });
}

module.exports = {
  SALT_ROUNDS,
  JWT_EXPIRES_IN,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken
};
