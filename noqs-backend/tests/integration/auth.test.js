const bcrypt = require('bcryptjs');

const mockSeedUsers = [{
  user_id: 1, email: 'owner@noqs.in',
  password_hash: bcrypt.hashSync('secret12345', 10),
  name: 'Owner', role: 'owner', merchant_id: 'MERCH-NOQS-01', branch_id: null, is_active: true
}];
const mockSeedMenu = [{
  id: 'butter-chicken', name: 'Butter Chicken', description: '', category: 'Mains',
  emoji: '🥘', price: 329, old_price: null, rating: 4.9, prep_minutes: 20,
  is_veg: false, popularity: 97, badges: [], featured: true, is_available: true, stock_count: null
}];

jest.mock('../../db', () => {
  const { createMockDb } = require('../helpers/mockDb');
  const { pool } = createMockDb({ users: mockSeedUsers, menu_items: mockSeedMenu });
  return pool;
});

const request = require('supertest');
const { buildApp } = require('../../app');

let app;
beforeAll(() => { app = buildApp(); });

describe('POST /api/auth/login', () => {
  test('200 + user + token on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'owner@noqs.in', password: 'secret12345' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('owner');
    expect(res.body.token).toEqual(expect.any(String));
  });

  test('401 on wrong password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'owner@noqs.in', password: 'nope' });
    expect(res.status).toBe(401);
  });
});

describe('Protected routes', () => {
  test('PUT /api/menu/:id → 401 without token', async () => {
    const res = await request(app).put('/api/menu/butter-chicken').send({ price: 999 });
    expect(res.status).toBe(401);
  });

  test('PUT /api/menu/:id → 200 with owner token', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ email: 'owner@noqs.in', password: 'secret12345' });
    const res = await request(app).put('/api/menu/butter-chicken')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ price: 399 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(399);
  });

  test('GET /api/orders → 401 without token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });
});
