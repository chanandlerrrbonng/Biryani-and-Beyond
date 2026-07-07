const express = require('express');
const orderController = require('../controllers/orderController');
const validateOrder = require('../middleware/validateOrder');
const validateOrderUpdate = require('../middleware/validateOrderUpdate');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const orderModel = require('../models/orderModel'); 

const router = express.Router();

// Public: customers place orders without accounts.
router.post('/orders', validateOrder, orderController.createOrder);

// Public: order tracking for customers (web or WhatsApp)
router.get('/orders/:id/track', async (req, res, next) => {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }
    
    // Public-safe projection: only return what the customer needs to see
    res.json({
      id: order.id,
      status: order.status,
      items: order.items.map(i => ({ name: i.name, qty: i.qty, emoji: i.emoji })),
      total: order.totals.grandTotal,
      createdAt: order.createdAt
    });
  } catch (err) { 
    next(err); 
  }
});

// Staff/owner: manage orders.
router.put('/orders/:id', authenticate, authorize('owner', 'staff'), validateOrderUpdate, orderController.updateOrder);
router.get('/orders/:id', authenticate, authorize('owner', 'staff'), orderController.getOrder);
router.get('/orders',     authenticate, authorize('owner', 'staff'), orderController.listOrders);

module.exports = router;