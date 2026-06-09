const menuModel = require('../models/menuModel');
const orderModel = require('../models/orderModel');

const ALLOWED_STATUSES = ['placed', 'confirmed', 'preparing', 'served', 'cancelled'];
const STATUS_FLOW = { placed: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['served', 'cancelled'], served: [], cancelled: [] };

function generateOrderId() {
  return 'NOQS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

exports.createOrder = async (req, res, next) => {
  try {
    const { customer, tableId, branchId, items, totals, promoCode } = req.body;
    const newOrder = {
      id: generateOrderId(),
      customer: { name: customer.name.trim(), phone: customer.phone, notes: customer.notes ? String(customer.notes).trim() : '' },
      tableId: tableId || null,
      branchId: branchId || 'BBSR-PURI-01',
      items: items.map((i) => ({ id: i.id, name: i.name, price: Number(i.price), qty: Number(i.qty), emoji: i.emoji || null })),
      totals: totals || null,
      promoCode: promoCode || null,
      status: 'placed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await orderModel.create(newOrder);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
};

exports.updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await orderModel.findById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: `Order '${id}' does not exist` });
    }

    const { status, customer, notes } = req.body;
    const patch = { updatedAt: new Date().toISOString() };

    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Bad Request', details: [`status must be one of: ${ALLOWED_STATUSES.join(', ')}`] });
      }
      const allowedNext = STATUS_FLOW[existing.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(409).json({ error: 'Conflict', message: `Cannot transition from '${existing.status}' to '${status}'`, allowedTransitions: allowedNext });
      }
      patch.status = status;
    }

    if (customer && typeof customer === 'object') {
      patch.customer = { ...existing.customer, ...customer };
    }
    if (typeof notes === 'string') {
      patch.customer = { ...(patch.customer || existing.customer), notes: notes.trim() };
    }

    const updated = await orderModel.update(id, patch);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Not Found', message: `Order '${req.params.id}' does not exist` });
    }
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
};

exports.listOrders = async (req, res, next) => {
  try {
    const orders = await orderModel.list();
    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
};