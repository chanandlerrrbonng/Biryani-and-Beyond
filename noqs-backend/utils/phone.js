/**
 * Phone normalisation. Your DB + validateOrder expect 10 digits; WhatsApp
 * sends E.164 (e.g. "919876543210"). Route ALL order creation through this
 * so web and WhatsApp orders store an identical 10-digit local number.
 */

function toLocal10(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  return digits.slice(-10); // best-effort fallback: last 10 digits
}

function toE164India(raw) {
  const local = toLocal10(raw);
  return local ? `91${local}` : null;
}

module.exports = { toLocal10, toE164India };
