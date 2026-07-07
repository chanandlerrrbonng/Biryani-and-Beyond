const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.get('/analytics/revenue', authenticate, authorize('owner'), async (req, res, next) => {
  try {
    const merchantId = req.user.merchantId;

    const revenueQueryText = `
      SELECT
        m.merchant_id, m.name AS merchant_name,
        b.branch_id, b.name AS branch_name,
        COUNT(o.order_id)::int AS active_order_count,
        COALESCE(SUM(o.subtotal), 0)::float     AS gross_subtotal,
        COALESCE(SUM(o.discount), 0)::float     AS total_discount,
        COALESCE(SUM(o.tax), 0)::float          AS total_tax,
        COALESCE(SUM(o.service), 0)::float      AS total_service,
        COALESCE(SUM(o.grand_total), 0)::float  AS total_revenue,
        COALESCE(ROUND(AVG(o.grand_total), 2), 0)::float AS avg_ticket_size
      FROM merchants m
      INNER JOIN branches b ON b.merchant_id = m.merchant_id
      LEFT JOIN orders o ON o.branch_id = b.branch_id
                        AND o.status IN ('placed','confirmed','preparing','served')
      WHERE m.merchant_id = $1
      GROUP BY m.merchant_id, b.branch_id
      ORDER BY total_revenue DESC`;

    const topItemsQueryText = `
      SELECT oi.menu_item_id, MAX(oi.name) AS name,
             SUM(oi.qty)::int AS units_sold,
             SUM(oi.qty * oi.unit_price)::float AS item_revenue
      FROM order_items oi
      INNER JOIN orders o ON o.order_id = oi.order_id
      INNER JOIN branches b ON b.branch_id = o.branch_id
      WHERE o.status <> 'cancelled' AND b.merchant_id = $1
      GROUP BY oi.menu_item_id
      ORDER BY units_sold DESC
      LIMIT 10`;

    const [revenueRes, topItemsRes] = await Promise.all([
      pool.query(revenueQueryText, [merchantId]),
      pool.query(topItemsQueryText, [merchantId])
    ]);

    res.json({ branchRevenue: revenueRes.rows, topItems: topItemsRes.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
