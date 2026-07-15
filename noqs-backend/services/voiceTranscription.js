// noqs-backend/services/voiceTranscription.js
/**
 * Voice note pipeline (StoreFront Copilot §3.5).
 *
 * Three steps, exactly as the doc describes:
 *   1. media ID  → temporary download URL   (Meta Graph API, needs WA token)
 *   2. URL       → raw audio bytes          (Meta CDN, ALSO needs WA token)
 *   3. bytes     → text transcript          (Groq Whisper, OpenAI-compatible)
 *
 * WhatsApp delivers voice notes as Opus-encoded OGG. Groq's Whisper endpoint
 * accepts `ogg` directly, so NO ffmpeg / transcoding step is required.
 *
 * ── WHATSAPP-API SWITCHOVER NOTE ─────────────────────────────────────────
 * Today (mock mode) there is no real Meta token, so real media cannot be
 * fetched. `fetchWhatsAppMedia` short-circuits and throws a clearly-typed
 * error which the worker turns into a friendly customer message. Once the
 * real WhatsApp Cloud API is connected, set WHATSAPP_TOKEN in .env and this
 * whole file works unchanged — nothing else to switch.
 * ─────────────────────────────────────────────────────────────────────────
 */

const OpenAI = require('openai');
const { toFile } = require('openai/uploads');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

// Reuse the SAME Groq credentials the agent already uses — no new API key.
const WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';
const DEFAULT_LANG = process.env.WHISPER_LANGUAGE_HINT || 'hi'; // Hindi hint

let _client = null;
function getWhisperClient() {
  if (_client) return _client;
  if (!process.env.GROQ_API_KEY) {
    const e = new Error('GROQ_API_KEY is not set — cannot transcribe voice notes.');
    e.code = 'NO_TRANSCRIPTION_KEY';
    throw e;
  }
  _client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
  });
  return _client;
}

/**
 * Step 1 + 2: resolve the media ID to a download URL, then download the bytes.
 * Both calls require the WhatsApp access token in the Authorization header —
 * forgetting the token on the *download* (not just the metadata) call is the
 * classic mistake called out in the roadmap (Phase 4).
 *
 * @param {string} mediaId  WhatsApp media id from the inbound message
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
async function fetchWhatsAppMedia(mediaId) {
  if (!WHATSAPP_TOKEN) {
    const e = new Error('WHATSAPP_TOKEN not configured — running in mock mode, real media cannot be downloaded.');
    e.code = 'NO_WHATSAPP_TOKEN';
    throw e;
  }
  if (!mediaId) {
    const e = new Error('No media id present on the voice message.');
    e.code = 'NO_MEDIA_ID';
    throw e;
  }

  // Step 1 — media id → temporary URL (+ mime type)
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
  });
  if (!metaRes.ok) {
    const body = await metaRes.text().catch(() => '');
    const e = new Error(`Media metadata fetch failed (${metaRes.status}): ${body}`);
    e.code = 'MEDIA_META_FAILED';
    throw e;
  }
  const meta = await metaRes.json();
  const mediaUrl = meta.url;
  const mimeType = meta.mime_type || 'audio/ogg';
  if (!mediaUrl) {
    const e = new Error('Media metadata did not include a download URL.');
    e.code = 'MEDIA_URL_MISSING';
    throw e;
  }

  // Step 2 — URL → bytes. The token is REQUIRED here too (Meta CDN 401s without it).
  const binRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
  });
  if (!binRes.ok) {
    const e = new Error(`Media download failed (${binRes.status}).`);
    e.code = 'MEDIA_DOWNLOAD_FAILED';
    throw e;
  }
  const arrayBuf = await binRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuf), mimeType };
}

/**
 * Step 3: transcribe raw audio bytes to text via Groq Whisper.
 *
 * @param {Buffer} buffer     raw audio bytes (Opus OGG from WhatsApp)
 * @param {object} [opts]
 * @param {string} [opts.mimeType]  used only to pick a sensible file extension
 * @param {string} [opts.language]  ISO-639-1 hint, defaults to 'hi'
 * @returns {Promise<string>} the transcript text (trimmed)
 */
async function transcribeAudio(buffer, { mimeType = 'audio/ogg', language = DEFAULT_LANG } = {}) {
  if (!buffer || !buffer.length) {
    const e = new Error('Empty audio buffer — nothing to transcribe.');
    e.code = 'EMPTY_AUDIO';
    throw e;
  }

  const client = getWhisperClient();

  // WhatsApp voice notes are audio/ogg (Opus). Give the SDK a filename with a
  // matching extension so the multipart upload is tagged correctly.
  const ext = mimeType.includes('mpeg') ? 'mp3'
    : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
    : mimeType.includes('wav') ? 'wav'
    : 'ogg';

  const file = await toFile(buffer, `voice-note.${ext}`, { type: mimeType });

  const transcription = await client.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
    language,              // Hindi hint → big accuracy win for Indian speech
    temperature: 0,
    response_format: 'json'
  });

  return (transcription.text || '').trim();
}

/**
 * Convenience wrapper used by the worker: media id → transcript.
 */
async function transcribeWhatsAppVoiceNote(mediaId, { language = DEFAULT_LANG } = {}) {
  const { buffer, mimeType } = await fetchWhatsAppMedia(mediaId);
  return transcribeAudio(buffer, { mimeType, language });
}

module.exports = {
  fetchWhatsAppMedia,
  transcribeAudio,
  transcribeWhatsAppVoiceNote
};
