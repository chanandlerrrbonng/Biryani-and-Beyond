/**
 * Validator for PUT /api/orders/:id. Update payloads are partial,
 * so all fields are optional — but if present they must be well-formed.
 */

const PHONE_REGEX = /^\d{10}$/;
const ALLOWED_STATUSES = ['placed', 'confirmed', 'preparing', 'served', 'cancelled'];

function validateOrderUpdate(req, res, next) {
  const errors = [];
  const body = req.body || {};

  if (Object.keys(body).length === 0) {
    errors.push('request body cannot be empty');
  }

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }

  if (body.customer !== undefined) {
    if (typeof body.customer !== 'object' || body.customer === null) {
      errors.push('customer must be an object');
    } else {
      if (body.customer.name !== undefined &&
          (typeof body.customer.name !== 'string' || body.customer.name.trim().length < 2)) {
        errors.push('customer.name must be at least 2 characters');
      }
      if (body.customer.phone !== undefined && !PHONE_REGEX.test(String(body.customer.phone))) {
        errors.push('customer.phone must be exactly 10 digits');
      }
    }
  }

  if (body.notes !== undefined && typeof body.notes !== 'string') {
    errors.push('notes must be a string');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Order update payload failed validation',
      details: errors
    });
  }

  next();
}

module.exports = validateOrderUpdate;
