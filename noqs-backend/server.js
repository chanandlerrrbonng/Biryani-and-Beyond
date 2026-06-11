const { buildApp } = require('./app');
const pool = require('./db');

const PORT = process.env.PORT || 4000;
const app = buildApp();

pool.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 NoQs API listening on http://localhost:${PORT}`);
      console.log(`   GET  /api/health`);
      console.log(`   GET  /api/menu`);
      console.log(`   PUT  /api/menu/:id     (invalidates cache)`);
      console.log(`   POST /api/orders`);
      console.log(`   PUT  /api/orders/:id`);
      console.log(`   GET  /api/analytics/revenue`);
    });
  })
  .catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
  });
