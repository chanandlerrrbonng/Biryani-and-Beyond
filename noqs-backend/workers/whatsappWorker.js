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
const { transcribeWhatsAppVoiceNote } = require('../services/voiceTranscription');

const DEDUPE_TTL_SECONDS = 86400;

async function alreadyProcessed(messageId) {
  const result = await getClient().set(
    `wa:seen:${messageId}`, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX'
  );
  return result === null;
}

async function resolveMessageText({ type, text, audioId, audioMime }) {
  if (type === 'text') {
    if (!text || !text.trim()) {
      const e = new Error('Empty text message body');
      e.code = 'EMPTY_TEXT';
      throw e;
    }
    return { text, wasVoice: false };
  }

  if (type === 'audio' || type === 'voice' || audioId) {
    if (!audioId) {
      const e = new Error('Audio message has no media ID');
      e.code = 'NO_MEDIA_ID';
      throw e;
    }
    const transcript = await transcribeWhatsAppVoiceNote(audioId);
    return { text: transcript, wasVoice: true };
  }

  const e = new Error(`Unsupported message type: ${type}`);
  e.code = 'UNSUPPORTED_TYPE';
  throw e;
}

async function processMessage(job) {
  const {
    messageId,
    from,
    contactName,
    type,
    text,
    audioId,
    audioMime
  } = job.data;

  if (await alreadyProcessed(messageId)) {
    console.log(`[worker] duplicate ${messageId} — skipping`);
    return {
      skipped: true,
      reason: 'duplicate'
    };
  }

  // Resolve text (typed OR transcribed voice) before the agent runs.
  let resolved;

  try {
    resolved = await resolveMessageText({
      type,
      text,
      audioId,
      audioMime
    });
  } catch (err) {
    console.warn(
      `[worker] could not resolve message ${messageId} (${err.code}): ${err.message}`
    );

    if (err.code === 'UNSUPPORTED_TYPE') {
      await sendWhatsAppReply(
        from,
        'I can read text and voice notes right now — please send one of those!'
      );
    } else if (err.code === 'NO_WHATSAPP_TOKEN') {
      await sendWhatsAppReply(
        from,
        "I can't listen to voice notes in this test setup yet — please type your order for now. 🙏"
      );
    } else if (err.code === 'NO_TRANSCRIPTION_KEY') {
      await sendWhatsAppReply(
        from,
        "Sorry, voice ordering isn't configured yet. Please type your order."
      );
    } else {
      await sendWhatsAppReply(
        from,
        "I couldn't quite hear that voice note — could you resend it or type your order? 🙏"
      );
    }

    return {
      skipped: true,
      reason: err.code || 'resolve-failed'
    };
  }

  const messageText = resolved.text;

  if (resolved.wasVoice) {
    console.log(
      `[worker] transcribed voice ${messageId} from ${from}: "${messageText}"`
    );
  } else {
    console.log(
      `[worker] processing ${messageId} from ${from}: "${messageText}"`
    );
  }

  const { reply, humanMode, session } = await handleMessage({
    sessionKey: from,
    text: messageText,
    customerPhone: toLocal10(from),
    contactName
  });

  if (humanMode) {
    console.log(
      `[worker] session ${from} is in HUMAN mode — routing to merchant.`
    );

    emitHumanInbound({
      sessionKey: from,
      phone: from,
      userText: messageText,
      isVoice: resolved.wasVoice,
      at: new Date().toISOString()
    });

    emitConversationUpdate({
      sessionKey: from,
      phone: from,
      userText: messageText,
      reply: null,
      mode: 'human',
      cart: session?.cart || [],
      stage: session?.stage,
      orderId: session?.orderId || null,
      by: 'customer',
      isVoice: resolved.wasVoice,
      at: new Date().toISOString()
    });

    return {
      humanMode: true
    };
  }

  const sendResult = await sendWhatsAppReply(from, reply);
  if (!sendResult.ok && !sendResult.simulated) {
    console.error(`[worker] WhatsApp send FAILED for ${from}:`, sendResult);
  }

  emitConversationUpdate({
    sessionKey: from,
    phone: from,
    userText: messageText,
    reply,
    mode: session?.mode || 'bot',
    cart: session?.cart || [],
    stage: session?.stage,
    orderId: session?.orderId || null,
    by: 'bot',
    isVoice: resolved.wasVoice,
    at: new Date().toISOString()
  });

  return {
    skipped: false,
    reply
  };
}

const worker = new Worker(QUEUE_NAME, processMessage, {
  connection: buildBullConnection(),
  concurrency: 5
});

worker.on('completed', (job, result) => console.log(`[worker] job ${job.id} done →`, result));
worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err?.message));

console.log(`👷 WhatsApp worker (agentic) listening on queue "${QUEUE_NAME}"`);
module.exports = worker;