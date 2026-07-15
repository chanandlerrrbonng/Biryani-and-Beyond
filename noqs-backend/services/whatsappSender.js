const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

async function sendWhatsAppReply(to, text) {
  if (!text) return { skipped: true };

  const token = process.env.WHATSAPP_TOKEN || '';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

  if (!token || !phoneId) {
    console.log(`[whatsapp-send] (simulated) → ${to}: ${text}`);
    return { simulated: true };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: String(to).replace(/\D/g, ''), // digits only, no '+'
        type: 'text',
        text: { preview_url: false, body: text.slice(0, 4096) } // WA hard limit
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[whatsapp-send] failed ${res.status}: ${body}`);
      return { ok: false, status: res.status };
    }
    console.log(`[whatsapp-send] success → ${to}`);
    return { ok: true };
  } catch (e) {
    console.error('[whatsapp-send] error:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendWhatsAppReply };
