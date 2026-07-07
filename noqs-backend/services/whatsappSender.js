/**
 * WhatsApp Cloud API outbound sender.
 *
 * In demo/dev (no WHATSAPP_TOKEN configured) this logs the reply and returns.
 * When real credentials are present it POSTs to the Graph API.
 */

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

async function sendWhatsAppReply(to, text) {
  if (!text) return { skipped: true };

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    // Demo mode — no real WhatsApp creds yet.
    console.log(`[whatsapp-send] → ${to}: ${text}`);
    return { simulated: true };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[whatsapp-send] failed ${res.status}: ${body}`);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (e) {
    console.error('[whatsapp-send] error:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendWhatsAppReply };
