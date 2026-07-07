const userModel = require('../models/userModel');
const { verifyPassword, signToken } = require('../utils/auth');

const COOKIE_NAME = 'noqs_token';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 12 * 60 * 60 * 1000 // 12h — keep in loose sync with JWT_EXPIRES_IN
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Bad Request', message: 'email and password are required' });
    }

    const row = await userModel.findByEmailWithHash(email);
    // Constant-ish response: same message whether email or password is wrong.
    if (!row || !row.is_active) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const user = userModel.rowToUser(row);
    const token = signToken(row);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    // Also return the token in the body for non-browser clients (and Socket.io).
    res.status(200).json({ user, token });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS, maxAge: undefined });
  res.status(200).json({ ok: true });
};

exports.me = async (req, res, next) => {
  try {
    const user = await userModel.findById(req.user.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Account not found or inactive' });
    }
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};
