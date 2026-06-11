/**
 * Verifies the Cache-Aside flow:
 *  - first request → MISS, hits DB
 *  - second request → HIT, does NOT hit DB
 *  - PUT /api/menu/:id → invalidates list + item
 */

const seedMenu = [
  { id: 'butter-chicken', name: 'Butter Chicken', description: '', category: 'Mains',
    emoji: '🥘', price: 329, old_price: null, rating: 4.9, prep_minutes: 20,
    is_veg: false, popularity: 97, badges: [], featured: true }
];

// Enable cache for this suite only (env.js sets CACHE_DISABLED=1 globally)
process.env.CACHE_DISABLED = '0';
process.env.USE_REDIS_MOCK = '1';
process.env.MENU_CACHE_TTL = '60';

// Spy on db so we can count real query calls
// Change "queryCount" to "mockQueryCount" so Jest allows it inside the mock factory
let mockQueryCount = 0; 

jest.mock('../../db', () => {
  const { createMockDb } = require('../helpers/mockDb');
  const { pool } = createMockDb({ menu_items: seedMenu });
  const realQuery = pool.query;
  // Intercepting and incrementing our tracking counter securely
  pool.query = (...args) => { 
    mockQueryCount++; 
    return realQuery(...args); 
  };
  return pool;
});

const request = require('supertest');
const { buildApp } = require('../../app');
const redis = require('../../cache/redisClient');

let app;
beforeAll(() => { app = buildApp(); });
afterAll(async () => { await redis.quit(); });

beforeEach(async () => {
  queryCount = 0;
  // wipe mock redis between tests
  const client = redis.getClient();
  if (client.flushall) await client.flushall();
});

describe('Cache-Aside on /api/menu', () => {
  test('first call MISS → second call HIT (no extra DB query)', async () => {
    const r1 = await request(app).get('/api/menu');
    expect(r1.status).toBe(200);
    expect(r1.headers['x-cache']).toBe('MISS');
    const afterFirst = mockQueryCount; // Fixed variable name
    expect(afterFirst).toBeGreaterThan(0);

    const r2 = await request(app).get('/api/menu');
    expect(r2.status).toBe(200);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(mockQueryCount).toBe(afterFirst); // Fixed variable name (ensures no extra DB call)
    expect(r2.body).toEqual(r1.body);
  });

  test('GET /api/menu/:id also caches per id', async () => {
    const r1 = await request(app).get('/api/menu/butter-chicken');
    expect(r1.headers['x-cache']).toBe('MISS');
    const r2 = await request(app).get('/api/menu/butter-chicken');
    expect(r2.headers['x-cache']).toBe('HIT');
  });
});

describe('Cache invalidation on PUT /api/menu/:id', () => {
  test('warm cache, PUT, next GET is a MISS again', async () => {
    await request(app).get('/api/menu');                       // MISS → cached
    const warm = await request(app).get('/api/menu');
    expect(warm.headers['x-cache']).toBe('HIT');

    const put = await request(app)
      .put('/api/menu/butter-chicken')
      .send({ price: 349 });
    expect(put.status).toBe(200);
    expect(put.body.price).toBe(349);
    expect(put.headers['x-cache-invalidated']).toMatch(/menu:list:\*/);

    const after = await request(app).get('/api/menu');
    expect(after.headers['x-cache']).toBe('MISS');             // invalidated
    expect(after.body[0].price).toBe(349);
  });
});
