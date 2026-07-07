const menuModel = require('../models/menuModel');
const orderModel = require('../models/orderModel');

const ALLOWED_STATUSES = ['placed', 'confirmed', 'preparing', 'served', 'cancelled'];
const STATUS_FLOW = { placed: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['served', 'cancelled'], served: [], cancelled: [] };

const orderService = require('../services/orderService');
const { scopeFilter } = require('../middleware/authorize');

function generateOrderId() {
  return 'NOQS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

exports.createOrder = async (req, res, next) => {
  try {
    const saved = await orderService.createOrder(req.body);
    res.status(201).json(saved);
  } catch (err) {
    // Surface validation-style errors as 400 (service throws typed errors)
    if (err.status === 400) {
      return res.status(400).json({ error: 'Bad Request', message: err.message, details: err.details });
    }
    if (err.status === 409) {
      return res.status(409).json({ error: 'Conflict', message: err.message, code: err.code });
    }
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
    const orders = await orderModel.list(scopeFilter(req));
    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
};