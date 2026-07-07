const pool = require('../db');

function rowToUser(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    merchantId: row.merchant_id,
    branchId: row.branch_id,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}

// Returns the FULL row (including password_hash) — used only by the login path.
exports.findByEmailWithHash = async (email) => {
  const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  return res.rows[0] || null;
};

exports.findById = async (userId) => {
  const res = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
  return rowToUser(res.rows[0]);
};

exports.create = async ({ email, passwordHash, name, role, merchantId, branchId }) => {
  const res = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, merchant_id, branch_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [email, passwordHash, name, role, merchantId || null, branchId || null]
  );
  return rowToUser(res.rows[0]);
};

exports.rowToUser = rowToUser;
