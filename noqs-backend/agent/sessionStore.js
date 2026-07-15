// noqs-backend/agent/sessionStore.js
const { getClient } = require('../cache/redisClient');

const TTL = Number(process.env.SESSION_TTL_SECONDS || 86400);

function key(sessionKey) {
  return `wa:session:${sessionKey}`;
}

function emptySession(sessionKey) {
  return {
    sessionKey,
    cart: [],
    history: [],
    stage: 'browsing',
    orderId: null,
    mode: 'bot',
    customerName: null,
    customerPhone: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function load(sessionKey) {
  try {
    const raw = await getClient().get(key(sessionKey));
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure all expected fields exist (in case session was saved by older code)
      return {
        ...emptySession(sessionKey),
        ...parsed,
        sessionKey // always override with the requested key
      };
    }
  } catch (e) {
    console.warn('[session] load failed:', e.message);
  }
  return emptySession(sessionKey);
}

async function save(session) {
  session.updatedAt = new Date().toISOString();
  try {
    await getClient().set(key(session.sessionKey), JSON.stringify(session), 'EX', TTL);
  } catch (e) {
    console.warn('[session] save failed:', e.message);
  }
  return session;
}

async function reset(sessionKey) {
  try { await getClient().del(key(sessionKey)); } catch { /* ignore */ }
  return emptySession(sessionKey);
}

module.exports = { load, save, reset, emptySession };
