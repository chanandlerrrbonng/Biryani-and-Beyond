require('dotenv').config();
const IORedis = require('ioredis');

// BullMQ needs its OWN connection, separate from cache/redisClient.js,
// because it requires maxRetriesPerRequest: null (it manages retries itself
// for blocking commands). Reusing the cache client would break both.
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function buildBullConnection() {
  if (process.env.USE_REDIS_MOCK === '1') {
    // BullMQ cannot run against ioredis-mock (no blocking command support).
    // Tests for queue/worker logic should mock Queue/Worker directly instead.
    throw new Error('BullMQ connection requested under USE_REDIS_MOCK=1 — mock the queue in tests instead.');
  }
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false
  });
}

module.exports = { buildBullConnection, REDIS_URL };
