CREATE INDEX IF NOT EXISTS idx_branches_merchant      ON branches(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_status   ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu       ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category    ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_featured    ON menu_items(featured) WHERE featured = TRUE;