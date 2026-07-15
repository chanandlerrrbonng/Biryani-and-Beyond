// Simulates Meta's webhook POST so the pipeline can be demoed without real
// WhatsApp Business API access.
//
// Usage (with backend + worker both running):
//   node scripts/simulateWhatsAppMessage.js "do biryani aur ek coke"
//   node scripts/simulateWhatsAppMessage.js --duplicate   (proves dedup)
//   node scripts/simulateWhatsAppMessage.js --voice        (voice-note path)
//   node scripts/simulateWhatsAppMessage.js --voice --media-id=<real-id>
//
// Requires Node 18+ (global fetch).

const PORT = process.env.PORT || 4000;
const URL = `http://localhost:${PORT}/api/webhooks/whatsapp`;

function buildTextPayload({ messageId, from, text }) {
  return {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: messageId,
            from,
            type: 'text',
            text: { body: text },
            timestamp: String(Math.floor(Date.now() / 1000))
          }]
        }
      }]
    }]
  };
}

function buildVoicePayload({ messageId, from, mediaId }) {
  return {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: messageId,
            from,
            type: 'audio',
            audio: { id: mediaId, mime_type: 'audio/ogg; codecs=opus', voice: true },
            timestamp: String(Math.floor(Date.now() / 1000))
          }]
        }
      }]
    }]
  };
}

async function send(payload) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log(`→ POST ${URL} responded ${res.status}`);
}

(async () => {
  const args = process.argv.slice(2);
  const isDuplicateTest = args.includes('--duplicate');
  const isVoiceTest = args.includes('--voice');
  const mediaArg = args.find((a) => a.startsWith('--media-id='));
  const mediaId = mediaArg ? mediaArg.split('=')[1] : `MEDIA_DEMO_${Date.now()}`;
  const from = '919876543210';

  if (isVoiceTest) {
    // NOTE: without a real WHATSAPP_TOKEN + a real media id, the worker will
    // reply with the friendly "can't listen in test setup" message — that is
    // the CORRECT behaviour and proves the voice branch is wired end-to-end.
    const messageId = `wamid.VOICE_${Date.now()}`;
    console.log(`Sending a VOICE payload (media id: ${mediaId})...`);
    await send(buildVoicePayload({ messageId, from, mediaId }));
    return;
  }

  const text = args.find((a) => !a.startsWith('--')) || 'do biryani aur ek coke';
  const messageId = `wamid.DEMO_${isDuplicateTest ? 'FIXED123' : Date.now()}`;
  const payload = buildTextPayload({ messageId, from, text });

  if (isDuplicateTest) {
    console.log('Sending the SAME message id twice to prove dedup...');
    await send(payload);
    await send(payload);
  } else {
    await send(payload);
  }
})();
