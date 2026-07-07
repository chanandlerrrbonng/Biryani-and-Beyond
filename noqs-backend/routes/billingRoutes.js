const express = require('express');
const { calcTotals } = require('../utils/billing');

const router = express.Router();

// Public: lets the web cart show the EXACT totals the backend will charge,
// eliminating web-vs-WhatsApp price drift (the Copilot's headline promise).
router.post('/billing/preview', (req, res) => {
  try {
    const { items = [], promoCode = null, dineIn = true } = req.body || {};
    const totals = calcTotals({ items, promoCode, dineIn });
    res.json(totals);
  } catch (err) {
    res.status(400).json({ error: 'Bad Request', message: err.message });
  }
});

module.exports = router;
