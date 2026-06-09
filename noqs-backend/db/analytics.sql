-- ============================================================
-- Task 613, Phase 2 — Active Billing Metrics per Branch
-- Uses INNER JOIN + aggregation, grouped by merchant
-- ============================================================
SELECT
  m.merchant_id,
  m.name           AS merchant_name,
  b.branch_id,
  b.name           AS branch_name,
  COUNT(o.order_id)                AS active_order_count,
  COALESCE(SUM(o.subtotal), 0)     AS gross_subtotal,
  COALESCE(SUM(o.discount), 0)     AS total_discount,
  COALESCE(SUM(o.tax), 0)          AS total_tax,
  COALESCE(SUM(o.service), 0)      AS total_service,
  COALESCE(SUM(o.grand_total), 0)  AS total_revenue,
  ROUND(AVG(o.grand_total), 2)     AS avg_ticket_size
FROM merchants m
INNER JOIN branches b ON b.merchant_id = m.merchant_id
INNER JOIN orders   o ON o.branch_id   = b.branch_id
WHERE o.status IN ('placed','confirmed','preparing','served')
GROUP BY m.merchant_id, b.branch_id
ORDER BY m.merchant_id, total_revenue DESC;

-- Bonus: Top-selling menu items across the chain
SELECT
  oi.menu_item_id,
  oi.name,
  SUM(oi.qty)                  AS units_sold,
  SUM(oi.qty * oi.unit_price)  AS item_revenue
FROM order_items oi
INNER JOIN orders o ON o.order_id = oi.order_id
WHERE o.status <> 'cancelled'
GROUP BY oi.menu_item_id
ORDER BY units_sold DESC
LIMIT 10;

-- ── Profiling (run BEFORE and AFTER creating indexes) ────────
EXPLAIN QUERY PLAN
SELECT * FROM orders
WHERE branch_id = 'BBSR-PURI-01' AND status = 'preparing';
-- Expected BEFORE: SCAN orders
-- Expected AFTER:  SEARCH orders USING INDEX idx_orders_branch_status
