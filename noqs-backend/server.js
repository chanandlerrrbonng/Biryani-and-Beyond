const http = require('http');
const { buildApp } = require('./app');
const pool = require('./db');
const { initRealtime } = require('./realtime/io');

const PORT = process.env.PORT || 4000;
const app = buildApp();
const server = http.createServer(app);

// Attach Socket.io to the same HTTP server (Phase 5 / 3.6 merchant inbox)
initRealtime(server);

pool.ready
  .then(() => {
    // Start the in-process WhatsApp worker so enqueued jobs are actually
    // consumed. (Previously the worker was never launched → messages were
    // acked with 200 OK but never processed. This was THE core bug.)
    if (process.env.USE_REDIS_MOCK !== '1') {
      require('./workers/whatsappWorker');
    }

    server.listen(PORT, () => {
      console.log(`🚀 NoQs API listening on http://localhost:${PORT}`);
      console.log(`   GET  /api/health`);
      console.log(`   GET  /api/menu`);
      console.log(`   POST /api/orders`);
      console.log(`   POST /api/webhooks/whatsapp   (async agent pipeline)`);
      console.log(`   GET  /api/inbox/sessions      (merchant inbox)`);
      console.log(`   WS   Socket.io                (live merchant inbox)`);
    });
  })
  .catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
  });
