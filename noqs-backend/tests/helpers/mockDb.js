/**
 * Lightweight in-memory stand-in for the real `db` module.
 * Each test gets a fresh instance via createMockDb().
 *
 * Exposes:
 *   pool.query(text, params) → { rows, rowCount }
 *   pool.connect()           → fake client with BEGIN/COMMIT/ROLLBACK
 *   pool.ready               → already-resolved Promise
 *   _state                   → direct access to seeded arrays for assertions
 */

function createMockDb(seed = {}) {
  const state = {
    menu_items: seed.menu_items ? [...seed.menu_items] : [],
    orders: seed.orders ? [...seed.orders] : [],
    order_items: seed.order_items ? [...seed.order_items] : [],
    merchants: seed.merchants || [],
    branches: seed.branches || []
  };

  function query(text, params = []) {
    const sql = String(text).replace(/\s+/g, ' ').trim().toLowerCase();

    // ── menu reads ──
    if (sql.startsWith('select * from menu_items where id =')) {
      const row = state.menu_items.find(m => m.id === params[0]);
      return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
    }
    if (sql.startsWith('select * from menu_items where lower(category)')) {
      const cat = String(params[0]).toLowerCase();
      const rows = state.menu_items
        .filter(m => m.category.toLowerCase() === cat)
        .sort((a, b) => b.popularity - a.popularity);
      return Promise.resolve({ rows, rowCount: rows.length });
    }
    if (sql.startsWith('select * from menu_items')) {
      const rows = [...state.menu_items].sort((a, b) => b.popularity - a.popularity);
      return Promise.resolve({ rows, rowCount: rows.length });
    }
    if (sql.startsWith('select count(*)') && sql.includes('menu_items')) {
      return Promise.resolve({ rows: [{ n: state.menu_items.length }], rowCount: 1 });
    }

    // ── menu update ──
    if (sql.startsWith('update menu_items set')) {
      const id = params[12];
      const idx = state.menu_items.findIndex(m => m.id === id);
      if (idx === -1) return Promise.resolve({ rows: [], rowCount: 0 });
      const cur = state.menu_items[idx];
      const next = {
        ...cur,
        name:        params[0]  ?? cur.name,
        description: params[1]  ?? cur.description,
        category:    params[2]  ?? cur.category,
        emoji:       params[3]  ?? cur.emoji,
        price:       params[4]  ?? cur.price,
        old_price:   params[5]  ?? cur.old_price,
        rating:      params[6]  ?? cur.rating,
        prep_minutes:params[7]  ?? cur.prep_minutes,
        is_veg:      params[8]  ?? cur.is_veg,
        popularity:  params[9]  ?? cur.popularity,
        badges:      params[10] ?? cur.badges,
        featured:    params[11] ?? cur.featured
      };
      state.menu_items[idx] = next;
      return Promise.resolve({ rows: [next], rowCount: 1 });
    }

    // ── orders ──
    if (sql.startsWith('insert into orders')) {
      const o = {
        order_id: params[0], branch_id: params[1], table_id: params[2],
        customer_name: params[3], customer_phone: params[4], customer_notes: params[5],
        promo_code: params[6], subtotal: params[7], discount: params[8],
        tax: params[9], service: params[10], delivery: params[11],
        grand_total: params[12], status: params[13],
        created_at: params[14], updated_at: params[15]
      };
      state.orders.push(o);
      return Promise.resolve({ rows: [o], rowCount: 1 });
    }
    if (sql.startsWith('insert into order_items')) {
      state.order_items.push({
        order_id: params[0], menu_item_id: params[1], name: params[2],
        unit_price: params[3], qty: params[4], emoji: params[5]
      });
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    if (sql.startsWith('select * from orders where order_id =')) {
      const row = state.orders.find(o => o.order_id === params[0]);
      return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
    }
    if (sql.startsWith('select * from order_items where order_id =')) {
      const rows = state.order_items.filter(i => i.order_id === params[0]);
      return Promise.resolve({ rows, rowCount: rows.length });
    }
    if (sql.startsWith('select * from orders')) {
      const rows = [...state.orders].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)));
      return Promise.resolve({ rows, rowCount: rows.length });
    }
    if (sql.startsWith('update orders set')) {
      const id = params[5];
      const idx = state.orders.findIndex(o => o.order_id === id);
      if (idx === -1) return Promise.resolve({ rows: [], rowCount: 0 });
      const cur = state.orders[idx];
      const next = {
        ...cur,
        status:         params[0] ?? cur.status,
        customer_name:  params[1] ?? cur.customer_name,
        customer_phone: params[2] ?? cur.customer_phone,
        customer_notes: params[3] ?? cur.customer_notes,
        updated_at:     params[4]
      };
      state.orders[idx] = next;
      return Promise.resolve({ rows: [next], rowCount: 1 });
    }

    // analytics — return empty aggregates, tests don't need real shape
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  const pool = {
    query,
    connect: async () => ({
      query,
      release: () => {}
    }),
    on: () => {},
    ready: Promise.resolve()
  };

  return { pool, _state: state };
}

module.exports = { createMockDb };

    // ── users ──
    if (sql.startsWith('select * from users where lower(email)')) {
      const email = String(params[0]).toLowerCase();
      const row = state.users.find(u => u.email.toLowerCase() === email);
      return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
    }
    if (sql.startsWith('select * from users where user_id =')) {
      const row = state.users.find(u => u.user_id === params[0]);
      return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
    }
    if (sql.startsWith('select count(*)') && sql.includes('users')) {
      return Promise.resolve({ rows: [{ n: state.users.length }], rowCount: 1 });
    }
    if (sql.startsWith('update menu_items set is_available')) {
      const id = params[1];
      const idx = state.menu_items.findIndex(m => m.id === id);
      if (idx === -1) return Promise.resolve({ rows: [], rowCount: 0 });
      state.menu_items[idx] = { ...state.menu_items[idx], is_available: params[0] };
      return Promise.resolve({ rows: [state.menu_items[idx]], rowCount: 1 });
    }

