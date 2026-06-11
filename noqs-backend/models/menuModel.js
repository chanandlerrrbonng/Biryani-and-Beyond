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
    featured: row.featured
  };
}

exports.getAll = async ({ category } = {}) => {
  let res;
  if (category && category !== 'All') {
    res = await pool.query(
      'SELECT * FROM menu_items WHERE LOWER(category) = LOWER($1) ORDER BY popularity DESC',
      [category]
    );
  } else {
    res = await pool.query('SELECT * FROM menu_items ORDER BY popularity DESC');
  }
  return res.rows.map(rowToMenuItem);
};

exports.findById = async (id) => {
  const res = await pool.query('SELECT * FROM menu_items WHERE id = $1', [id]);
  return rowToMenuItem(res.rows[0]);
};

// Used by PUT /api/menu/:id  (Task 616 Phase 3 — invalidation trigger source)
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
      featured     = COALESCE($12::bool,   featured)
    WHERE id = $13
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
    id
  ];
  const res = await pool.query(text, v);
  return rowToMenuItem(res.rows[0]);
};
