/**
 * Pure billing calculators — no I/O, no Express, no DB.
 * Designed to be 100% unit-testable.
 *
 * Conventions:
 * - All monetary values are rupees (₹), rounded to 2 decimals on output.
 * - Negative quantities/prices are treated as invalid and throw.
 */

const TAX_RATE = 0.05;      // 5% GST (single-slab demo)
const SERVICE_RATE = 0.05;  // 5% service — MUST match frontend display. (was 0.10)

const PROMOS = {
  NOQS10:    { type: 'percent', value: 10, maxOff: 100 },  // matches frontend
  WELCOME10: { type: 'percent', value: 10, maxOff: 100 },
  FLAT50:    { type: 'flat',    value: 50 },
  BIRYANI20: { type: 'percent', value: 20, maxOff: 150, appliesTo: 'Biryani' }
};

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calcSubtotal(items) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  let subtotal = 0;
  for (const it of items) {
    if (typeof it.price !== 'number' || it.price < 0) {
      throw new RangeError(`invalid price for item ${it.id}`);
    }
    if (!Number.isInteger(it.qty) || it.qty < 1) {
      throw new RangeError(`invalid qty for item ${it.id}`);
    }
    subtotal += it.price * it.qty;
  }
  return round2(subtotal);
}

function applyPromo(subtotal, promoCode, items = []) {
  if (!promoCode) return 0;
  const promo = PROMOS[promoCode];
  if (!promo) return 0;

  let eligible = subtotal;
  if (promo.appliesTo) {
    eligible = items
      .filter(i => i.category === promo.appliesTo)
      .reduce((s, i) => s + i.price * i.qty, 0);
  }

  let discount = promo.type === 'flat'
    ? promo.value
    : (eligible * promo.value) / 100;

  if (promo.maxOff) discount = Math.min(discount, promo.maxOff);
  return round2(Math.min(discount, subtotal));   // never refund more than charged
}

function calcTax(taxable)     { return round2(taxable * TAX_RATE); }
function calcService(taxable) { return round2(taxable * SERVICE_RATE); }

/**
 * Full ticket calculator used by POST /api/orders preview/validation.
 */
function calcTotals({ items, promoCode = null, dineIn = true } = {}) {
  const subtotal = calcSubtotal(items);
  const discount = applyPromo(subtotal, promoCode, items);
  const taxable  = round2(subtotal - discount);
  const tax      = calcTax(taxable);
  const service  = dineIn ? calcService(taxable) : 0;
  const grandTotal = round2(taxable + tax + service);
  return { subtotal, discount, tax, service, delivery: 0, grandTotal };
}

/**
 * Split-bill: divides grandTotal into N shares, putting any remainder
 * (in paise) on the first payer so the sum equals the grand total exactly.
 */
function splitBill(grandTotal, n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError('split count must be a positive integer');
  }
  const totalPaise = Math.round(grandTotal * 100);
  const base = Math.floor(totalPaise / n);
  const remainder = totalPaise - base * n;
  const shares = Array(n).fill(base / 100);
  shares[0] = round2(shares[0] + remainder / 100);
  return shares;
}

module.exports = {
  TAX_RATE,
  SERVICE_RATE,
  PROMOS,
  round2,
  calcSubtotal,
  applyPromo,
  calcTax,
  calcService,
  calcTotals,
  splitBill
};