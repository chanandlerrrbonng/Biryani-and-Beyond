// Simulates Meta's webhook POST so the pipeline can be demoed without real
// WhatsApp Business API access (which needs Meta verification — Phase 1's
// "next step", not tonight's blocker).
//
// Usage (with backend + worker both running):
//   node scripts/simulateWhatsAppMessage.js "do biryani aur ek coke"
//   node scripts/simulateWhatsAppMessage.js --duplicate   (proves dedup)
//
// Requires Node 18+ (global fetch).

const PORT = process.env.PORT || 4000;
const URL = `http://localhost:${PORT}/api/webhooks/whatsapp`;

function buildPayload({ messageId, from, text }) {
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
  const text = args.find(a => !a.startsWith('--')) || 'do biryani aur ek coke';
  const messageId = `wamid.DEMO_${isDuplicateTest ? 'FIXED123' : Date.now()}`;
  const from = '91XXXXXXXXXX';

  const payload = buildPayload({ messageId, from, text });

  if (isDuplicateTest) {
    console.log('Sending the SAME message id twice to prove dedup...');
    await send(payload);
    await send(payload); // worker should skip this one
  } else {
    await send(payload);
  }
})();
