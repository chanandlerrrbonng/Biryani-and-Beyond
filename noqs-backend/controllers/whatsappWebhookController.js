const { getWhatsAppQueue } = require('../queues/whatsappQueue');
const { verifySignature } = require('../utils/whatsappSignature');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'noqs-dev-verify-token';

// GET /api/webhooks/whatsapp — Meta's verification handshake.
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
exports.receiveMessage = async (req, res) => {
  // 1) Verify authenticity BEFORE doing anything else. Reject forgeries.
  const signature = req.get('x-hub-signature-256');
  if (!verifySignature(req.rawBody, signature)) {
    console.warn('[whatsapp] rejected webhook: bad or missing signature');
    return res.sendStatus(401);
  }

  // 2) Ack immediately (Meta requires <5s; must happen before any LLM work).
  res.sendStatus(200);

  // 3) Enqueue for async processing.
  try {
    logStatusUpdates(req.body);

    const messages = extractMessages(req.body);
    if (!messages.length) return; // status callbacks / read receipts — ignore.

    const queue = getWhatsAppQueue();
    for (const message of messages) {
      await queue.add('inbound-message', message, {
        // jobId = WhatsApp message id → BullMQ-level dedup on top of the
        // Redis SET NX dedup in the worker. Belt and suspenders.
        jobId: message.messageId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
      });
      console.log(`[whatsapp] enqueued message ${message.messageId} from ${message.from}`);
    }
  } catch (err) {
    console.error('[whatsapp] failed to enqueue inbound message:', err.message);
  }
};

// Meta can batch multiple messages in one webhook; handle all of them.
function extractMessages(payload) {
  const out = [];
  const entries = payload?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value;
      const contactName = value?.contacts?.[0]?.profile?.name || null;
      for (const msg of value?.messages || []) {
        const audio = msg.audio || msg.voice || null;
        out.push({
          messageId: msg.id,
          from: msg.from,
          contactName,
          type: msg.type,
          text: msg.text?.body || null,
          audioId: audio?.id || null,
          audioMime: audio?.mime_type || null,
          timestamp: msg.timestamp,
          receivedAt: new Date().toISOString()
        });
      }
    }
  }
  return out;
}

function logStatusUpdates(payload) {
  const entries = payload?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      for (const status of change.value?.statuses || []) {
        console.log(
          `[whatsapp-status] ${status.id} → ${status.status}` +
          (status.errors ? ` | ERROR: ${JSON.stringify(status.errors)}` : '')
        );
      }
    }
  }
}
