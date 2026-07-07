const pool = require('../db');

function rowToMenuItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    desc: row.description,
    category: row.category,
    emoji: row.emoji,
    price: Number(row.price),
    oldPrice: row.old_price !== null ? Number(row.old_price) : null,
    rating: row.rating !== null ? Number(row.rating) : null,
    prep: row.prep_minutes,
    veg: row.is_veg,
    popularity: row.popularity,
    badges: row.badges || [],
    featured: row.featured,
    available: row.is_available,
    stockCount: row.stock_count !== null && row.stock_count !== undefined ? Number(row.stock_count) : null
  };
}

// includeUnavailable: admin panel passes true; public menu + AI agent pass false.
exports.getAll = async ({ category, includeUnavailable = false } = {}) => {
  const clauses = [];
  const params = [];

  if (category && category !== 'All') {
    params.push(category);
    clauses.push(`LOWER(category) = LOWER($${params.length})`);
  }
  if (!includeUnavailable) {
    clauses.push('is_available = TRUE');
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await pool.query(
    `SELECT * FROM menu_items ${where} ORDER BY popularity DESC`,
    params
  );
  return res.rows.map(rowToMenuItem);
};

exports.findById = async (id) => {
  const res = await pool.query('SELECT * FROM menu_items WHERE id = $1', [id]);
  return rowToMenuItem(res.rows[0]);
};

exports.create = async (item) => {
  const text = `
    INSERT INTO menu_items
      (id, name, description, category, emoji, price, old_price, rating,
       prep_minutes, is_veg, popularity, badges, featured, is_available, stock_count)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *`;
  const v = [
    item.id, item.name, item.desc ?? item.description ?? '', item.category,
    item.emoji ?? null, item.price, item.oldPrice ?? null, item.rating ?? null,
    item.prep ?? null, typeof item.veg === 'boolean' ? item.veg : true,
    item.popularity ?? 0, Array.isArray(item.badges) ? item.badges : [],
    !!item.featured,
    typeof item.available === 'boolean' ? item.available : true,
    item.stockCount ?? null
  ];
  const res = await pool.query(text, v);
  return rowToMenuItem(res.rows[0]);
};

exports.update = async (id, patch) => {
  const text = `
    UPDATE menu_items SET
      name         = COALESCE($1::text,    name),
      description  = COALESCE($2::text,    description),
      category     = COALESCE($3::text,    category),
      emoji        = COALESCE($4::text,    emoji),
      price        = COALESCE($5::numeric, price),
      old_price    = COALESCE($6::numeric, old_price),
      rating       = COALESCE($7::numeric, rating),
      prep_minutes = COALESCE($8::int,     prep_minutes),
      is_veg       = COALESCE($9::bool,    is_veg),
      popularity   = COALESCE($10::int,    popularity),
      badges       = COALESCE($11::text[], badges),
      featured     = COALESCE($12::bool,   featured),
      is_available = COALESCE($13::bool,   is_available),
      stock_count  = COALESCE($14::int,    stock_count)
    WHERE id = $15
    RETURNING *`;
  const v = [
    patch.name ?? null,
    patch.desc ?? patch.description ?? null,
    patch.category ?? null,
    patch.emoji ?? null,
    patch.price ?? null,
    patch.oldPrice ?? null,
    patch.rating ?? null,
    patch.prep ?? null,
    typeof patch.veg === 'boolean' ? patch.veg : null,
    patch.popularity ?? null,
    Array.isArray(patch.badges) ? patch.badges : null,
    typeof patch.featured === 'boolean' ? patch.featured : null,
    typeof patch.available === 'boolean' ? patch.available : null,
    patch.stockCount ?? null,
    id
  ];
  const res = await pool.query(text, v);
  return rowToMenuItem(res.rows[0]);
};

// Dedicated lightweight path for the availability toggle (PATCH).
exports.setAvailability = async (id, available) => {
  const res = await pool.query(
    'UPDATE menu_items SET is_available = $1::bool WHERE id = $2 RETURNING *',
    [available, id]
  );
  return rowToMenuItem(res.rows[0]);
};

exports.remove = async (id) => {
  const res = await pool.query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [id]);
  return res.rowCount > 0;
};
// Set stock quantity directly. Also auto-flips availability when it hits 0.
exports.setStock = async (id, stockCount) => {
  const available = Number(stockCount) > 0;
  const res = await pool.query(
    `UPDATE menu_items
       SET stock_count = $1::int,
           is_available = $2::bool
     WHERE id = $3
     RETURNING *`,
    [stockCount, available, id]
  );
  return rowToMenuItem(res.rows[0]);
};
