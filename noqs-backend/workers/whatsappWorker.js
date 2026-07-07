// noqs-backend/workers/whatsappWorker.js
require('dotenv').config();
const { Worker } = require('bullmq');
const { buildBullConnection } = require('../queues/connection');
const { QUEUE_NAME } = require('../queues/whatsappQueue');
const { getClient } = require('../cache/redisClient');
const { handleMessage } = require('../agent/agentService');
const { toLocal10 } = require('../utils/phone');
const { sendWhatsAppReply } = require('../services/whatsappSender');
const { emitConversationUpdate, emitHumanInbound } = require('../realtime/io');
const sessionStore = require('../agent/sessionStore');

const DEDUPE_TTL_SECONDS = 86400;

async function alreadyProcessed(messageId) {
  const result = await getClient().set(
    `wa:seen:${messageId}`, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX'
  );
  return result === null;
}

async function processMessage(job) {
  const { messageId, from, type, text } = job.data;

  if (await alreadyProcessed(messageId)) {
    console.log(`[worker] duplicate ${messageId} — skipping`);
    return { skipped: true, reason: 'duplicate' };
  }

  // Voice (3.5) intentionally skipped for now — text only.
  if (type !== 'text' || !text) {
    console.log(`[worker] non-text message type "${type}" — not handled yet`);
    await sendWhatsAppReply(from, 'For now I can only read text messages. Please type your order!');
    return { skipped: true, reason: 'unsupported-type' };
  }

  console.log(`[worker] processing ${messageId} from ${from}: "${text}"`);

  const { reply, humanMode, session } = await handleMessage({
    sessionKey: from,
    text,
    customerPhone: toLocal10(from)
  });

  if (humanMode) {
    console.log(`[worker] session ${from} is in HUMAN mode — routing to merchant.`);
    emitHumanInbound({
      sessionKey: from,
      phone: from,
      userText: text,
      at: new Date().toISOString()
    });
    // Also push a conversation:update so the inbox thread stays current.
    emitConversationUpdate({
      sessionKey: from,
      phone: from,
      userText: text,
      reply: null,
      mode: 'human',
      cart: session?.cart || [],
      stage: session?.stage,
      orderId: session?.orderId || null,
      by: 'customer',
      at: new Date().toISOString()
    });
    return { humanMode: true };
  }

  await sendWhatsAppReply(from, reply);

  // Push the full exchange to the live merchant inbox.
  emitConversationUpdate({
    sessionKey: from,
    phone: from,
    userText: text,
    reply,
    mode: session?.mode || 'bot',
    cart: session?.cart || [],
    stage: session?.stage,
    orderId: session?.orderId || null,
    by: 'bot',
    at: new Date().toISOString()
  });

  return { skipped: false, reply };
}

const worker = new Worker(QUEUE_NAME, processMessage, {
  connection: buildBullConnection(),
  concurrency: 5
});

worker.on('completed', (job, result) => console.log(`[worker] job ${job.id} done →`, result));
worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err?.message));

console.log(`👷 WhatsApp worker (agentic) listening on queue "${QUEUE_NAME}"`);
module.exports = worker;
