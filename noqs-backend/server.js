const express = require('express');
const cors = require('cors');
const path = require('path');

const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Global middleware ───────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);

// ── Health probe ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'noqs-backend',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ── Feature routes ──────────────────────────────────────────
app.use('/api', menuRoutes);
app.use('/api', orderRoutes);

// ── 404 catch-all ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`
  });
});

// ── Centralised error handler (must be last) ────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🍛 NoQs API listening on http://localhost:${PORT}`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/menu`);
  console.log(`   POST /api/orders`);
  console.log(`   PUT  /api/orders/:id`);
});
