const seedMenu = [
  { id: 'butter-chicken', name: 'Butter Chicken', description: '', category: 'Mains',
    emoji: '🥘', price: 329, old_price: null, rating: 4.9, prep_minutes: 20,
    is_veg: false, popularity: 97, badges: [], featured: true }
];

jest.mock('../../db', () => {
  const { createMockDb } = require('../helpers/mockDb');
  const { pool } = createMockDb({ menu_items: seedMenu });
  return pool;
});

const request = require('supertest');
const { buildApp } = require('../../app');

const validBody = {
  customer: { name: 'Asha', phone: '9876543210', notes: 'no chilli' },
  branchId: 'BBSR-PURI-01',
  items: [{ id: 'butter-chicken', name: 'Butter Chicken', price: 329, qty: 2 }],
  totals: { grandTotal: 658 }
};

let app;
beforeAll(() => { app = buildApp(); });

describe('POST /api/orders — validation', () => {
  test('400 when customer missing', async () => {
    const res = await request(app).post('/api/orders').send({ ...validBody, customer: undefined });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.details.some(d => d.startsWith('customer'))).toBe(true);
  });

  test('400 when phone is not 10 digits', async () => {
    const res = await request(app).post('/api/orders').send({
      ...validBody, customer: { name: 'A', phone: '123' }
    });
    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toMatch(/phone/);
    expect(res.body.details.join(' ')).toMatch(/name/);   // min 2 chars also fails
  });

  test('400 when items empty', async () => {
    const res = await request(app).post('/api/orders').send({ ...validBody, items: [] });
    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatch(/items/);
  });

  test('400 when qty is not integer', async () => {
    const res = await request(app).post('/api/orders').send({
      ...validBody,
      items: [{ id: 'x', name: 'X', price: 100, qty: 1.5 }]
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/orders — happy path', () => {
  test('201 + returned shape', async () => {
    const res = await request(app).post('/api/orders').send(validBody);
    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^NOQS-/),
      status: 'placed',
      branchId: 'BBSR-PURI-01',
      customer: expect.objectContaining({ name: 'Asha', phone: '9876543210' }),
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'butter-chicken', qty: 2 })
      ])
    }));
  });
});

describe('PUT /api/orders/:id — status transitions', () => {
  let createdId;

  beforeAll(async () => {
    const res = await request(app).post('/api/orders').send(validBody);
    createdId = res.body.id;
  });

  test('400 for invalid status string', async () => {
    const res = await request(app).put(`/api/orders/${createdId}`).send({ status: 'nope' });
    expect(res.status).toBe(400);
  });

  test('409 for illegal transition (placed → served)', async () => {
    const res = await request(app).put(`/api/orders/${createdId}`).send({ status: 'served' });
    expect(res.status).toBe(409);
    expect(res.body.allowedTransitions).toEqual(['confirmed', 'cancelled']);
  });

  test('200 for legal transition placed → confirmed', async () => {
    const res = await request(app).put(`/api/orders/${createdId}`).send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });

  test('404 for unknown order id', async () => {
    const res = await request(app).put('/api/orders/NOQS-MISSING').send({ status: 'confirmed' });
    expect(res.status).toBe(404);
  });

  test('400 for empty body', async () => {
    const res = await request(app).put(`/api/orders/${createdId}`).send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders', () => {
  test('200 + array', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
