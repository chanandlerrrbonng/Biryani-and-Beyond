const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SLOW_SQL_MS = Number(process.env.SLOW_SQL_MS || 50);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PG client', err);
});

// ── Task 616 Phase 1: wrap query() to measure each statement ──
const originalQuery = pool.query.bind(pool);
pool.query = async function timedQuery(...args) {
  const t0 = process.hrtime.bigint();
  try {
    const res = await originalQuery(...args);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms >= SLOW_SQL_MS) {
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
      console.warn(`[sql-slow] ${ms.toFixed(2)}ms :: ${String(text).slice(0, 120)}…`);
    }
    return res;
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.error(`[sql-err]  ${ms.toFixed(2)}ms :: ${e.message}`);
    throw e;
  }
};

async function initializeDatabase() {
  const schemaSql  = fs.readFileSync(path.join(__dirname, 'schema.sql'),  'utf-8');
  const indexesSql = fs.readFileSync(path.join(__dirname, 'indexes.sql'), 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query(indexesSql);

    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM menu_items');
    if (rows[0].n === 0) {
      const menuPath = path.join(__dirname, '..', 'data', 'menu.json');
      if (fs.existsSync(menuPath)) {
        const items = JSON.parse(fs.readFileSync(menuPath, 'utf-8'));
        const insert = `
          INSERT INTO menu_items
            (id, name, description, category, emoji, price, old_price, rating,
             prep_minutes, is_veg, popularity, badges, featured)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (id) DO NOTHING`;
        for (const it of items) {
          await client.query(insert, [
            it.id, it.name, it.desc, it.category, it.emoji,
            it.price, it.oldPrice, it.rating, it.prep, it.veg,
            it.popularity, it.badges || [], !!it.featured
          ]);
        }
        console.log(`🌱 Seeded ${items.length} menu items into menu_items`);
      }
    }

    await client.query('COMMIT');
    console.log('✅ PostgreSQL connected and schema verified');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to initialize PostgreSQL database:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

pool.ready = initializeDatabase();

module.exports = pool;
