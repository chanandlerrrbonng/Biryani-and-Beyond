/**
 * Socket.io event handlers for merchant → server actions.
 * Kept separate from io.js to avoid circular imports.
 */

const sessionStore = require('../agent/sessionStore');
const { sendWhatsAppReply } = require('../services/whatsappSender');

function register(socket, io) {
  // Merchant sends a manual reply to a customer (human-handoff mode).
  socket.on('merchant:reply', async ({ sessionKey, text } = {}) => {
    try {
      if (!sessionKey || !text) return;
      const session = await sessionStore.load(sessionKey);
      session.history.push({ role: 'assistant', content: text });
      await sessionStore.save(session);

      await sendWhatsAppReply(sessionKey, text);

      io.emit('conversation:update', {
        sessionKey,
        phone: sessionKey,
        userText: null,
        reply: text,
        mode: session.mode,
        cart: session.cart,
        stage: session.stage,
        orderId: session.orderId,
        by: 'merchant',
        at: new Date().toISOString()
      });
    } catch (e) {
      console.error('[inbox] merchant:reply failed:', e.message);
    }
  });

  // Merchant toggles between bot and human control of a session.
  socket.on('merchant:mode', async ({ sessionKey, mode } = {}) => {
    try {
      if (!sessionKey || !['bot', 'human'].includes(mode)) return;
      const session = await sessionStore.load(sessionKey);
      session.mode = mode;
      await sessionStore.save(session);

      io.emit('conversation:mode', {
        sessionKey,
        phone: sessionKey,
        mode,
        at: new Date().toISOString()
      });
    } catch (e) {
      console.error('[inbox] merchant:mode failed:', e.message);
    }
  });
}

module.exports = { register };
