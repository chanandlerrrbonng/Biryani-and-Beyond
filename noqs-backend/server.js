require('dotenv').config();
const express = require('express');
const cors = require('cors');

const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// ── CORS allowlist from .env (Task 614 Phase 3) ──
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'
).split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);          // same-origin / curl
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Return false (not an Error) so cors responds with a clean 403 header
    // rather than bubbling to the 500-error handler.
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

app.use(express.json({ limit: '100kb' }));
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

// Wait for schema / seed before accepting traffic
pool.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 NoQs API listening on http://localhost:${PORT}`);
      console.log(`   GET  /api/health`);
      console.log(`   GET  /api/menu`);
      console.log(`   POST /api/orders`);
      console.log(`   PUT  /api/orders/:id`);
      console.log(`   GET  /api/analytics/revenue`);
      console.log(`   CORS allowlist: ${ALLOWED_ORIGINS.join(', ')}`);
    });
  })
  .catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
  });
