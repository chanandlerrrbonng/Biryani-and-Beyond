const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authenticate, authController.me);

module.exports = router;
