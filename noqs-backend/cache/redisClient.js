/**
 * Lazy-initialised Redis client (ioredis).
 * In tests, REDIS_URL can be left unset and ioredis-mock is injected instead.
 *
 * Helpers:
 *   - getJSON(key)                : parsed JSON or null
 *   - setJSON(key, val, ttl)      : SETEX with TTL seconds
 *   - del(...keys)                : invalidate one or more keys
 *   - delPattern(pattern)         : SCAN+DEL all matching keys (e.g. menu:*)
 */

let client = null;
let connecting = null;

function buildClient() {
  // Test injection: tests/helpers/env.js sets USE_REDIS_MOCK=1
  if (process.env.USE_REDIS_MOCK === '1') {
    const RedisMock = require('ioredis-mock');
    return new RedisMock();
  }
  const Redis = require('ioredis');
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const r = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true
  });
  r.on('error', (e) => console.error('[redis] error:', e.message));
  r.on('connect', () => console.log(`[redis] connected → ${url}`));
  return r;
}

function getClient() {
  if (!client) client = buildClient();
  return client;
}

async function getJSON(key) {
  try {
    const raw = await getClient().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`[cache] GET ${key} failed:`, e.message);
    return null;                       // fail-open
  }
}

async function setJSON(key, value, ttlSeconds) {
  try {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await getClient().set(key, payload, 'EX', ttlSeconds);
    } else {
      await getClient().set(key, payload);
    }
  } catch (e) {
    console.warn(`[cache] SET ${key} failed:`, e.message);
  }
}

async function del(...keys) {
  if (!keys.length) return;
  try { await getClient().del(...keys); }
  catch (e) { console.warn(`[cache] DEL failed:`, e.message); }
}

async function delPattern(pattern) {
  try {
    const c = getClient();
    const stream = c.scanStream({ match: pattern, count: 100 });
    const pipeline = c.pipeline();
    let n = 0;
    for await (const keys of stream) {
      if (keys.length) { pipeline.del(...keys); n += keys.length; }
    }
    if (n) await pipeline.exec();
    return n;
  } catch (e) {
    console.warn(`[cache] delPattern ${pattern} failed:`, e.message);
    return 0;
  }
}

async function quit() {
  if (client && client.quit) {
    try { await client.quit(); } catch { /* ignore */ }
    client = null;
  }
}

module.exports = { getClient, getJSON, setJSON, del, delPattern, quit };
