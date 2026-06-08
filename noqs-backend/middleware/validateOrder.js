/**
 * Custom payload validator for POST /api/orders.
 * Collects ALL errors before responding so the client can fix
 * everything in one round-trip, not field-by-field.
 */

const PHONE_REGEX = /^\d{10}$/;

function validateOrder(req, res, next) {
  const errors = [];
  const body = req.body || {};

  // ── customer block ────────────────────────────────────────
  if (!body.customer || typeof body.customer !== 'object') {
    errors.push('customer is required and must be an object');
  } else {
    if (!body.customer.name || typeof body.customer.name !== 'string' ||
        body.customer.name.trim().length < 2) {
      errors.push('customer.name is required (min 2 characters)');
    }
    if (!body.customer.phone || !PHONE_REGEX.test(String(body.customer.phone))) {
      errors.push('customer.phone is required and must be exactly 10 digits');
    }
  }

  // ── branch / table identifier ─────────────────────────────
  if (!body.tableId && !body.branchId) {
    errors.push('tableId or branchId is required');
  }

  // ── items array ───────────────────────────────────────────
  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('items must be a non-empty array');
  } else {
    body.items.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        errors.push(`items[${idx}] must be an object`);
        return;
      }
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`items[${idx}].id is required (string)`);
      }
      if (!item.name || typeof item.name !== 'string') {
        errors.push(`items[${idx}].name is required (string)`);
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        errors.push(`items[${idx}].price must be a non-negative number`);
      }
      if (!Number.isInteger(item.qty) || item.qty < 1) {
        errors.push(`items[${idx}].qty must be an integer >= 1`);
      }
    });
  }

  // ── totals (optional but, if present, must be sane) ───────
  if (body.totals !== undefined) {
    if (typeof body.totals !== 'object' || body.totals === null) {
      errors.push('totals must be an object when provided');
    } else if (typeof body.totals.grandTotal !== 'number' || body.totals.grandTotal < 0) {
      errors.push('totals.grandTotal must be a non-negative number');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Order payload failed validation',
      details: errors
    });
  }

  next();
}

module.exports = validateOrder;
