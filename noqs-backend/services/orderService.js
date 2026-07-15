/**
 * Order creation service — the single place an order is born, whether from
 * the website, the WhatsApp agent, or a Razorpay webhook. No Express here.
 */

const orderModel = require('../models/orderModel');
const menuModel = require('../models/menuModel');
const { calcTotals } = require('../utils/billing');
const { toLocal10 } = require('../utils/phone');
const { del, delPattern } = require('../cache/redisClient');

function generateOrderId() {
  return 'NOQS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function badRequest(message, details) {
  const e = new Error(message);
  e.status = 400;
  if (details) e.details = details;
  return e;
}

/**
 * @param {object} input  { customer, tableId, branchId, items, promoCode, dineIn, source }
 * @returns saved order
 */
async function createOrder(input = {}) {
  const {
    customer = {},
    tableId,
    branchId,
    items,
    promoCode = null,
    dineIn = true,
    source
  } = input;

  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('items must be a non-empty array');
  }

  // Re-price every line from the live catalog — never trust client prices.
  const priced = [];
  for (const line of items) {
    const menuItem = await menuModel.findById(line.id);
    if (!menuItem) throw badRequest(`Unknown menu item: ${line.id}`);
    if (menuItem.available === false) throw badRequest(`Item unavailable: ${menuItem.name}`);

    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      throw badRequest(`Invalid qty for ${line.id}`);
    }

    priced.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      qty,
      emoji: menuItem.emoji || null,
      category: menuItem.category
    });
  }

  // Authoritative totals from the shared billing engine.
  const totals = calcTotals({ items: priced, promoCode, dineIn });

  const phone = toLocal10(customer.phone);

  const order = {
    id: generateOrderId(),
    customer: {
      name: (customer.name || '').trim() || 'WhatsApp Customer',
      phone,
      notes: customer.notes ? String(customer.notes).trim() : ''
    },
    tableId: tableId || null,
    branchId: branchId || 'BBSR-PURI-01',
    items: priced.map(({ category, ...keep }) => keep), // strip category for storage
    totals,
    promoCode,
    source: source || 'web',
    status: 'placed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = await orderModel.create(order);

  // Stock/availability just changed — invalidate so the next storefront
  // fetch (or the 30s catalog poll) reflects it immediately.
  delPattern('menu:list:*').catch(() => {});
  Promise.all(priced.map((p) => del(`menu:item:${p.id}`))).catch(() => {});

  return saved;
}

module.exports = { createOrder, generateOrderId };