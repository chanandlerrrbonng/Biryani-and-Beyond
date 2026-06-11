const {
  calcSubtotal, applyPromo, calcTax, calcService,
  calcTotals, splitBill, round2
} = require('../../utils/billing');

describe('billing — subtotal', () => {
  test('sums price * qty correctly', () => {
    expect(calcSubtotal([
      { id: 'a', price: 100, qty: 2 },
      { id: 'b', price: 49.5, qty: 4 }
    ])).toBe(398);
  });

  test('returns 0 for empty cart', () => {
    expect(calcSubtotal([])).toBe(0);
  });

  test('throws on negative price', () => {
    expect(() => calcSubtotal([{ id: 'x', price: -1, qty: 1 }])).toThrow(RangeError);
  });

  test('throws on non-integer qty', () => {
    expect(() => calcSubtotal([{ id: 'x', price: 10, qty: 1.5 }])).toThrow(RangeError);
  });

  test('throws when items is not an array', () => {
    expect(() => calcSubtotal('nope')).toThrow(TypeError);
  });
});

describe('billing — promos', () => {
  test('returns 0 when no promo code', () => {
    expect(applyPromo(500, null)).toBe(0);
  });

  test('returns 0 for unknown promo', () => {
    expect(applyPromo(500, 'NOPE')).toBe(0);
  });

  test('FLAT50 deducts ₹50', () => {
    expect(applyPromo(500, 'FLAT50')).toBe(50);
  });

  test('WELCOME10 = 10% capped at ₹100', () => {
    expect(applyPromo(500, 'WELCOME10')).toBe(50);     // 10% of 500
    expect(applyPromo(2000, 'WELCOME10')).toBe(100);   // capped
  });

  test('BIRYANI20 only applies to biryani subtotal', () => {
    const items = [
      { id: 'biryani-hyd', category: 'Biryani', price: 300, qty: 1 },
      { id: 'mango-lassi', category: 'Drinks',  price: 130, qty: 1 }
    ];
    // 20% of 300 = 60 (under ₹150 cap)
    expect(applyPromo(430, 'BIRYANI20', items)).toBe(60);
  });

  test('discount never exceeds subtotal', () => {
    expect(applyPromo(20, 'FLAT50')).toBe(20);
  });
});

describe('billing — tax & service', () => {
  test('tax = 5% of taxable', () => {
    expect(calcTax(1000)).toBe(50);
  });
  test('service = 10% of taxable (dine-in)', () => {
    expect(calcService(1000)).toBe(100);
  });
});

describe('billing — calcTotals integration', () => {
  test('basic dine-in ticket', () => {
    const items = [{ id: 'a', price: 200, qty: 2, category: 'Mains' }];
    const t = calcTotals({ items });
    expect(t.subtotal).toBe(400);
    expect(t.discount).toBe(0);
    expect(t.tax).toBe(20);
    expect(t.service).toBe(40);
    expect(t.grandTotal).toBe(460);
  });

  test('with FLAT50 + dine-in', () => {
    const items = [{ id: 'a', price: 200, qty: 2, category: 'Mains' }];
    const t = calcTotals({ items, promoCode: 'FLAT50' });
    // subtotal 400, discount 50, taxable 350, tax 17.5, service 35, total 402.5
    expect(t).toEqual({
      subtotal: 400, discount: 50, tax: 17.5,
      service: 35, delivery: 0, grandTotal: 402.5
    });
  });

  test('takeaway has no service charge', () => {
    const items = [{ id: 'a', price: 100, qty: 1, category: 'Mains' }];
    const t = calcTotals({ items, dineIn: false });
    expect(t.service).toBe(0);
    expect(t.grandTotal).toBe(105);
  });
});

describe('billing — splitBill edge cases', () => {
  test('even split', () => {
    expect(splitBill(400, 4)).toEqual([100, 100, 100, 100]);
  });

  test('uneven split puts remainder on payer #1', () => {
    const shares = splitBill(100, 3);
    expect(shares).toHaveLength(3);
    expect(round2(shares.reduce((a, b) => a + b, 0))).toBe(100);
    expect(shares[0]).toBeGreaterThanOrEqual(shares[1]);
  });

  test('rejects n < 1', () => {
    expect(() => splitBill(100, 0)).toThrow(RangeError);
    expect(() => splitBill(100, 1.5)).toThrow(RangeError);
  });

  test('single payer pays everything', () => {
    expect(splitBill(123.45, 1)).toEqual([123.45]);
  });
});
