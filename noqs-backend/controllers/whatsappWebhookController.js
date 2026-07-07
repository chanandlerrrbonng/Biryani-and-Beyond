const { getWhatsAppQueue } = require('../queues/whatsappQueue');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'noqs-dev-verify-token';

// GET /api/webhooks/whatsapp — Meta's verification handshake.
// In production this route is registered with the Meta Developer Console.
// Tonight we hit it directly to prove the handshake logic works.
exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[whatsapp] webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

// POST /api/webhooks/whatsapp — async ingestion.
// MUST return 200 within 5s or WhatsApp retries (causing duplicate messages).
// No LLM call happens here — only enqueue. This is the core Phase 1 guarantee.
exports.receiveMessage = async (req, res) => {
  res.sendStatus(200); // ack immediately, before any processing

  try {
    const message = extractMessage(req.body);
    if (!message) return; // status callbacks / read receipts — ignore for now

    await getWhatsAppQueue().add('inbound-message', message, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    });
    console.log(`[whatsapp] enqueued message ${message.messageId} from ${message.from}`);
  } catch (err) {
    // Ack already sent — log only. A real failure here should alert, not retry via WhatsApp.
    console.error('[whatsapp] failed to enqueue inbound message:', err.message);
  }
};

// Meta's webhook payload is deeply nested; this pulls out what Phase 1 needs.
function extractMessage(payload) {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const msg = value?.messages?.[0];
  if (!msg) return null;

  return {
    messageId: msg.id,
    from: msg.from,                  // E.164 phone number, no '+'
    type: msg.type,                  // 'text' | 'audio' | ...
    text: msg.text?.body || null,
    timestamp: msg.timestamp,
    receivedAt: new Date().toISOString()
  };
}
