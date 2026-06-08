const express = require('express');
const orderController = require('../controllers/orderController');
const validateOrder = require('../middleware/validateOrder');
const validateOrderUpdate = require('../middleware/validateOrderUpdate');

const router = express.Router();

// POST /api/orders — create new order (validated)
router.post('/orders', validateOrder, orderController.createOrder);

// PUT /api/orders/:id — update order status / details (validated)
router.put('/orders/:id', validateOrderUpdate, orderController.updateOrder);

// GET /api/orders/:id — fetch one order
router.get('/orders/:id', orderController.getOrder);

// GET /api/orders — list all orders (admin/debug)
router.get('/orders', orderController.listOrders);

module.exports = router;
