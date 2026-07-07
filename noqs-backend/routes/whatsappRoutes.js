const express = require('express');
const whatsappWebhookController = require('../controllers/whatsappWebhookController');

const router = express.Router();

router.get('/webhooks/whatsapp', whatsappWebhookController.verifyWebhook);
router.post('/webhooks/whatsapp', whatsappWebhookController.receiveMessage);

module.exports = router;
