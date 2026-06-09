const pool = require('../db');

async function rowToOrder(row) {
  if (!row) return null;

  const itemsRes = await pool.query(
    'SELECT * FROM order_items WHERE order_id = $1',
    [row.order_id]
  );

  return {
    id: row.order_id,
    branchId: row.branch_id,
    tableId: row.table_id,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      notes: row.customer_notes || ''
    },
    promoCode: row.promo_code,
    totals: {
      subtotal:  Number(row.subtotal),
      discount:  Number(row.discount),
      tax:       Number(row.tax),
      service:   Number(row.service),
      delivery:  Number(row.delivery),
      grandTotal:Number(row.grand_total)
    },
    items: itemsRes.rows.map(i => ({
      id: i.menu_item_id,
      name: i.name,
      price: Number(i.unit_price),
      qty: i.qty,
      emoji: i.emoji
    })),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

exports.create = async (order) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertOrderText = `
      INSERT INTO orders (
        order_id, branch_id, table_id, customer_name, customer_phone, customer_notes,
        promo_code, subtotal, discount, tax, service, delivery, grand_total, status,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`;

    const orderValues = [
      order.id, order.branchId, order.tableId,
      order.customer.name, order.customer.phone, order.customer.notes || '',
      order.promoCode,
      order.totals?.subtotal  ?? 0,
      order.totals?.discount  ?? 0,
      order.totals?.tax       ?? 0,
      order.totals?.service   ?? 0,
      order.totals?.delivery  ?? 0,
      order.totals?.grandTotal?? 0,
      order.status, order.createdAt, order.updatedAt
    ];

    const orderRes = await client.query(insertOrderText, orderValues);

    const insertItemText = `
      INSERT INTO order_items (order_id, menu_item_id, name, unit_price, qty, emoji)
      VALUES ($1,$2,$3,$4,$5,$6)`;

    for (const i of order.items) {
      await client.query(insertItemText, [
        order.id, i.id, i.name, i.price, i.qty, i.emoji
      ]);
    }

    await client.query('COMMIT');
    return await rowToOrder(orderRes.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

exports.findById = async (id) => {
  const res = await pool.query('SELECT * FROM orders WHERE order_id = $1', [id]);
  return await rowToOrder(res.rows[0]);
};

exports.list = async () => {
  const res = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  return await Promise.all(res.rows.map(rowToOrder));
};

// FIX: explicit ::type casts on every parameter so Postgres can infer types
// even when the JS value is `null`. Without these casts, COALESCE($1, status)
// throws "could not determine data type of parameter $1".
exports.update = async (id, patch) => {
  const updateText = `
    UPDATE orders SET
      status         = COALESCE($1::text,    status),
      customer_name  = COALESCE($2::text,    customer_name),
      customer_phone = COALESCE($3::text,    customer_phone),
      customer_notes = COALESCE($4::text,    customer_notes),
      updated_at     = $5::timestamp
    WHERE order_id = $6
    RETURNING *`;

  const values = [
    patch.status ?? null,
    patch.customer?.name  ?? null,
    patch.customer?.phone ?? null,
    patch.customer?.notes ?? null,
    patch.updatedAt,
    id
  ];

  const res = await pool.query(updateText, values);
  return await rowToOrder(res.rows[0]);
};
