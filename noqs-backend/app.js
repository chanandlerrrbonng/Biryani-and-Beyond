require('dotenv').config();
const express = require('express');
const cors = require('cors');

const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const timing = require('./middleware/timing');

function buildApp() {
  const app = express();

  const ALLOWED_ORIGINS = (
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'
  ).split(',').map(s => s.trim()).filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
  }));

  app.use(express.json({ limit: '100kb' }));
  app.use(timing);            // Task 616 Phase 1 — per-request timer
  app.use(requestLogger);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'noqs-backend',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api', menuRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', analyticsRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} does not exist`
    });
  });

  app.use(errorHandler);
  return app;
}

module.exports = { buildApp };
