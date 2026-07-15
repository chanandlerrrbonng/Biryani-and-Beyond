/**
 * Verifies the X-Hub-Signature-256 header that Meta attaches to every
 * webhook POST. Meta computes HMAC-SHA256 over the RAW request body using
 * your App Secret. If we parse the body first and re-stringify it, the bytes
 * won't match — so this MUST run against the raw Buffer.
 *
 * Uses timingSafeEqual to avoid timing side-channels.
 */
const crypto = require('crypto');

const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

function verifySignature(rawBody, signatureHeader) {
  // If no app secret is configured (local/mock mode), skip verification but
  // make it loud so it can never silently ship to production.
  if (!APP_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[whatsapp] WHATSAPP_APP_SECRET missing in production — rejecting webhook');
      return false;
    }
    console.warn('[whatsapp] WHATSAPP_APP_SECRET not set — skipping signature check (dev only)');
    return true;
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  if (!rawBody || !rawBody.length) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifySignature };
