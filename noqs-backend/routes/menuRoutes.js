const express = require('express');
const menuController = require('../controllers/menuController');

const router = express.Router();

router.get('/menu',         menuController.getMenu);
router.get('/menu/:id',     menuController.getMenuItem);
router.put('/menu/:id',     menuController.updateMenuItem);  // ← new

module.exports = router;
