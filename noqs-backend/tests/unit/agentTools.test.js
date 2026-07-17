jest.mock('../../db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  on: jest.fn()
}));

const { toolMap } = require('../../agent/tools');
const sessionStore = require('../../agent/sessionStore');
const orderService = require('../../services/orderService');

jest.mock('../../services/orderService');

describe('Agent Tools — apply_promo_code', () => {
  let session;

  beforeEach(() => {
    session = sessionStore.emptySession('test-session');
    session.cart = [
      { id: 'paneer-tikka', name: 'Paneer Tikka', price: 250, qty: 2, category: 'Starters' }
    ];
    jest.clearAllMocks();
  });

  test('apply_promo_code applies a valid promo code successfully', async () => {
    const tool = toolMap['apply_promo_code'];
    const result = await tool.run({ promoCode: 'FLAT50' }, session);

    expect(result.ok).toBe(true);
    expect(result.promoCode).toBe('FLAT50');
    expect(session.promoCode).toBe('FLAT50');
    expect(result.totals.discount).toBe(50);
  });

  test('apply_promo_code rejects invalid promo code', async () => {
    const tool = toolMap['apply_promo_code'];
    const result = await tool.run({ promoCode: 'INVALID' }, session);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid promo code');
    expect(session.promoCode).toBeUndefined();
  });

  test('view_cart uses the applied promo code', async () => {
    session.promoCode = 'FLAT50';
    const tool = toolMap['view_cart'];
    const result = await tool.run({}, session);

    expect(result.totals.discount).toBe(50);
  });

  test('place_order passes the promo code and clears it on success', async () => {
    session.promoCode = 'FLAT50';
    session.customerPhone = '1234567890';
    
    orderService.createOrder.mockResolvedValue({
      id: 'NOQS-TEST123',
      status: 'received',
      totals: { grandTotal: 495 }
    });

    const tool = toolMap['place_order'];
    const result = await tool.run({ customerName: 'Alice' }, session);

    expect(result.ok).toBe(true);
    expect(result.orderId).toBe('NOQS-TEST123');
    expect(orderService.createOrder).toHaveBeenCalledWith({
      customer: { name: 'Alice', phone: '1234567890', notes: undefined },
      items: [{ id: 'paneer-tikka', qty: 2 }],
      promoCode: 'FLAT50',
      branchId: 'BBSR-PURI-01',
      dineIn: true,
      source: 'whatsapp'
    });
    expect(session.promoCode).toBeNull();
    expect(session.cart).toEqual([]);
  });
});
