const express = require('express');
const menuController = require('../controllers/menuController');
const { attachUserIfPresent, authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Public reads — attach user if logged in so owners see unavailable items.
router.get('/menu',     attachUserIfPresent, menuController.getMenu);
router.get('/menu/:id', attachUserIfPresent, menuController.getMenuItem);

// Owner/staff writes.
router.post('/menu',                    authenticate, authorize('owner'),          menuController.createMenuItem);
router.put('/menu/:id',                 authenticate, authorize('owner'),          menuController.updateMenuItem);
router.patch('/menu/:id/availability',  authenticate, authorize('owner', 'staff'), menuController.setAvailability);
router.patch('/menu/:id/stock',         authenticate, authorize('owner', 'staff'), menuController.setStock);
router.delete('/menu/:id',              authenticate, authorize('owner'),          menuController.deleteMenuItem);

module.exports = router;
