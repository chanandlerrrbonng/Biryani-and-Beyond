const express = require('express');
const menuController = require('../controllers/menuController');

const router = express.Router();

// GET /api/menu — list all menu items (optionally filtered by ?category=)
router.get('/menu', menuController.getMenu);

// GET /api/menu/:id — single item lookup
router.get('/menu/:id', menuController.getMenuItem);

module.exports = router;
