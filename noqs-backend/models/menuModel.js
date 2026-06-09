const pool = require('../db');

// Shape a DB row into the API response shape used by the frontend
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

// Parameterized query – no string concatenation (Task 614 Phase 2)
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
