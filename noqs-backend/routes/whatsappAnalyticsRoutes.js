const express = require('express');
const pool = require('../db');
const { getClient } = require('../cache/redisClient');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// GET /api/analytics/whatsapp — bot-channel metrics for the owner.
router.get('/analytics/whatsapp', authenticate, authorize('owner'), async (req, res, next) => {
  try {
    const merchantId = req.user.merchantId;

    // Completed WhatsApp orders + avg cart size, scoped to this merchant.
    const ordersRes = await pool.query(
      `SELECT
         COUNT(*)::int                          AS wa_orders,
         COALESCE(ROUND(AVG(o.grand_total),2),0)::float AS avg_cart_size,
         COALESCE(SUM(o.grand_total),0)::float   AS wa_revenue
       FROM orders o
       INNER JOIN branches b ON b.branch_id = o.branch_id
       WHERE b.merchant_id = $1
         AND o.source = 'whatsapp'
         AND o.status <> 'cancelled'`,
      [merchantId]
    );

    // Top items ordered via WhatsApp.
    const topItemsRes = await pool.query(
      `SELECT oi.menu_item_id, MAX(oi.name) AS name, SUM(oi.qty)::int AS units_sold
       FROM order_items oi
       INNER JOIN orders o ON o.order_id = oi.order_id
       INNER JOIN branches b ON b.branch_id = o.branch_id
       WHERE b.merchant_id = $1 AND o.source = 'whatsapp' AND o.status <> 'cancelled'
       GROUP BY oi.menu_item_id
       ORDER BY units_sold DESC
       LIMIT 10`,
      [merchantId]
    );

    // Live conversation volume from Redis sessions (all sessions = conversations).
    // Conversion rate = orders / conversations.
    let conversations = 0;
    let converted = 0;
    try {
      const c = getClient();
      const stream = c.scanStream({ match: 'wa:session:*', count: 100 });
      for await (const keys of stream) {
        for (const key of keys) {
          const raw = await c.get(key);
          if (!raw) continue;
          conversations++;
          try { if (JSON.parse(raw).orderId) converted++; } catch { /* skip */ }
        }
      }
    } catch (e) {
      console.warn('[analytics] redis scan failed:', e.message);
    }

    const conversionRate = conversations > 0
      ? Math.round((converted / conversations) * 1000) / 10 // one decimal %
      : 0;

    res.json({
      conversations,
      convertedConversations: converted,
      conversionRate,                    // percent
      completedOrders: ordersRes.rows[0].wa_orders,
      avgCartSize: ordersRes.rows[0].avg_cart_size,
      revenue: ordersRes.rows[0].wa_revenue,
      topItems: topItemsRes.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
