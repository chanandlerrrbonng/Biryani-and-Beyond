/**
 * Socket.io singleton for the live Merchant Inbox (Phase 5 / doc §3.6).
 * Attached to the existing Express HTTP server in server.js.
 *
 * Events emitted to merchant clients:
 *   conversation:update  → { phone, sessionKey, userText, reply, mode, cart, stage, orderId, at }
 *   conversation:human   → { phone, sessionKey, userText, at }   (human-mode inbound)
 *
 * Events received from merchant clients:
 *   merchant:reply       → { sessionKey, text }   (dispatch to customer)
 *   merchant:mode        → { sessionKey, mode }   (toggle bot|human)
 */

const { Server } = require('socket.io');
const { verifyToken } = require('../utils/auth');

let io = null;

function initRealtime(httpServer) {
  const ALLOWED_ORIGINS = (
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Require a valid owner/staff JWT to connect.
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer /, '');

      if (!token) {
        return next(new Error('unauthorized'));
      }

      const user = verifyToken(token);

      if (!['owner', 'staff'].includes(user.role)) {
        return next(new Error('forbidden'));
      }

      socket.user = user;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  // Lazy require to avoid circular deps (handlers touch sessionStore/worker helpers)
  const inboxHandlers = require('./inboxHandlers');

  io.on('connection', (socket) => {
    console.log(
      `[socket] merchant connected: ${socket.id} (${socket.user?.role})`
    );

    inboxHandlers.register(socket, io);

    socket.on('disconnect', () => {
      console.log(`[socket] merchant disconnected: ${socket.id}`);
    });
  });

  console.log('🔌 Socket.io initialised for merchant inbox');
  return io;
}

function getIO() {
  return io; // may be null in worker-only contexts; callers must null-check
}

function emitConversationUpdate(payload) {
  if (io) {
    io.emit('conversation:update', payload);
  }
}

function emitHumanInbound(payload) {
  if (io) {
    io.emit('conversation:human', payload);
  }
}

module.exports = {
  initRealtime,
  getIO,
  emitConversationUpdate,
  emitHumanInbound
};