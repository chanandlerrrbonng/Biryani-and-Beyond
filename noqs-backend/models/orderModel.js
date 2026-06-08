/**
 * In-memory order store. For this task we don't need persistence —
 * a Map keyed by orderId is enough. Swap for MongoDB/Postgres later
 * by keeping the same exported function signatures.
 */

const orders = new Map();

exports.create = (order) => {
  orders.set(order.id, order);
  return order;
};

exports.findById = (id) => orders.get(id) || null;

exports.update = (id, patch) => {
  const existing = orders.get(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  orders.set(id, merged);
  return merged;
};

exports.list = () => Array.from(orders.values());

exports.remove = (id) => orders.delete(id);

exports.clear = () => orders.clear();
