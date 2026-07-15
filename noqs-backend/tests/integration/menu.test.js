/**
 * Integration tests for /api/menu — uses Supertest against an Express app
 * built in-process, with the `db` module mocked (Phase 3 isolation).
 */

const path = require('path');

// ── Phase 3: mock the db module BEFORE requiring app ──
const mockSeedMenu = [
  { id: 'butter-chicken', name: 'Butter Chicken', description: 'Creamy', category: 'Mains',
    emoji: '🥘', price: 329, old_price: 379, rating: 4.9, prep_minutes: 20,
    is_veg: false, popularity: 97, badges: ['nonveg'], featured: true },
  { id: 'masala-chai', name: 'Masala Chai', description: 'Spiced tea', category: 'Drinks',
    emoji: '🍵', price: 49, old_price: null, rating: 4.6, prep_minutes: 4,
    is_veg: true, popularity: 78, badges: ['veg'], featured: false }
];

jest.mock('../../db', () => {
  const { createMockDb } = require('../helpers/mockDb');
  const { pool } = createMockDb({ menu_items: mockSeedMenu });
  return pool;
});

const request = require('supertest');
const { buildApp } = require('../../app');

let app;
beforeAll(() => { app = buildApp(); });

describe('GET /api/menu', () => {
  test('200 + JSON array sorted by popularity desc', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe('butter-chicken');         // popularity 97 > 78
    expect(res.body[0]).toEqual(expect.objectContaining({
      id: 'butter-chicken',
      name: 'Butter Chicken',
      price: 329,
      veg: false,
      featured: true,
      badges: expect.any(Array)
    }));
  });

  test('?category=Drinks filters correctly', async () => {
    const res = await request(app).get('/api/menu?category=Drinks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('masala-chai');
  });

  test('?category=NoSuch returns empty array, still 200', async () => {
    const res = await request(app).get('/api/menu?category=NoSuch');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/menu/:id', () => {
  test('200 for known id', async () => {
    const res = await request(app).get('/api/menu/butter-chicken');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('butter-chicken');
  });

  test('404 with explanatory body for unknown id', async () => {
    const res = await request(app).get('/api/menu/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({
      error: 'Not Found',
      message: expect.stringContaining('does-not-exist')
    }));
  });
});

describe('Unknown route', () => {
  test('404 from catch-all handler', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
