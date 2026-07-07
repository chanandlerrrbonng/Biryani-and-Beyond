const express = require('express');
const { getClient } = require('../cache/redisClient');
const sessionStore = require('../agent/sessionStore');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// List all active WhatsApp sessions (keys: wa:session:*)
router.get('/inbox/sessions', authenticate, authorize('owner', 'staff'), async (req, res, next) => {
  try {
    const c = getClient();
    const sessions = [];
    const stream = c.scanStream({ match: 'wa:session:*', count: 100 });
    for await (const keys of stream) {
      for (const key of keys) {
        const raw = await c.get(key);
        if (!raw) continue;
        try {
          const s = JSON.parse(raw);
          sessions.push({
            sessionKey: s.sessionKey,
            phone: s.sessionKey,
            stage: s.stage,
            mode: s.mode,
            orderId: s.orderId || null,
            cartCount: (s.cart || []).reduce((n, i) => n + i.qty, 0),
            lastMessage: [...(s.history || [])].reverse().find((h) => h.content)?.content || '',
            updatedAt: s.updatedAt
          });
        } catch { /* skip malformed */ }
      }
    }
    sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// Full thread for one session
router.get('/inbox/sessions/:key', authenticate, authorize('owner', 'staff'), async (req, res, next) => {
  try {
    const s = await sessionStore.load(req.params.key);
    res.json({
      sessionKey: s.sessionKey,
      phone: s.sessionKey,
      stage: s.stage,
      mode: s.mode,
      orderId: s.orderId || null,
      cart: s.cart || [],
      history: (s.history || []).filter((h) => h.content),
      updatedAt: s.updatedAt
    });
  } catch (err) {
    next(err);
  }
});

// Toggle bot|human mode via REST (mirrors the socket event)
router.patch('/inbox/sessions/:key/mode', authenticate, authorize('owner', 'staff'), async (req, res, next) => {
  try {
    const { mode } = req.body || {};
    if (!['bot', 'human'].includes(mode)) {
      return res.status(400).json({ error: 'Bad Request', message: 'mode must be bot|human' });
    }
    const s = await sessionStore.load(req.params.key);
    s.mode = mode;
    await sessionStore.save(s);
    res.json({ ok: true, sessionKey: s.sessionKey, mode });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
