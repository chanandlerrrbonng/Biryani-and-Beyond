require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const authRoutes = require('./routes/authRoutes');
const billingRoutes = require('./routes/billingRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const inboxRoutes = require('./routes/inboxRoutes');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const timing = require('./middleware/timing');

function buildApp() {
  const app = express();

  const ALLOWED_ORIGINS = (
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'
  ).split(',').map(s => s.trim()).filter(Boolean);

  // ── WhatsApp webhook: needs the RAW body for HMAC signature verification. ──
  // We mount a JSON parser scoped ONLY to this path, using the `verify` hook to
  // stash the raw bytes on req.rawBody BEFORE JSON.parse mutates nothing (parse
  // still produces req.body for the controller). The GET verification handshake
  // carries no body, so this is a no-op for it.
  app.use(
    '/api/webhooks/whatsapp',
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => { req.rawBody = buf; }
    })
  );
  app.use('/api', whatsappRoutes);

  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
  }));

  app.use(express.json({ limit: process.env.JSON_LIMIT || '100kb' }));
  app.use(cookieParser());
  app.use(timing);
  app.use(requestLogger);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'noqs-backend', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
  });

  app.use('/api', authRoutes);
  app.use('/api', menuRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', billingRoutes);
  app.use('/api', analyticsRoutes);
  app.use('/api', inboxRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.originalUrl} does not exist` });
  });

  app.use(errorHandler);
  return app;
}

module.exports = { buildApp };
