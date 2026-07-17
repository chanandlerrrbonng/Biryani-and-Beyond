// noqs-backend/agent/tools.js
const menuModel = require('../models/menuModel');
const orderModel = require('../models/orderModel');
const orderService = require('../services/orderService');
const { calcTotals, calcSubtotal } = require('../utils/billing');

// ── helpers ──
function cartLine(menuItem, qty) {
  return {
    id: menuItem.id,
    name: menuItem.name,
    price: menuItem.price,
    qty,
    emoji: menuItem.emoji || null,
    category: menuItem.category
  };
}

function summariseCart(session) {
  if (!session.cart.length) return { items: [], subtotal: 0, note: 'Cart is empty.' };
  const subtotal = calcSubtotal(session.cart);
  return {
    items: session.cart.map((i) => ({
      id: i.id, name: i.name, qty: i.qty, price: i.price, lineTotal: i.price * i.qty, emoji: i.emoji
    })),
    subtotal
  };
}

// ── search_menu ──
const searchMenu = {
  schema: {
    type: 'function',
    function: {
      name: 'search_menu',
      description:
        'Search the restaurant menu to find available dishes. Call this tool whenever the customer asks about the menu, wants to see items, asks about categories, or before adding any item to the cart. You can search by keyword (e.g. "biryani", "paneer", "chicken") and/or filter by category. If the customer asks for "best" or "popular" or "top rated" items, search with an empty query to get all items sorted by popularity, then recommend the top ones. Returns a list of matching items with id, name, price, rating, veg/non-veg status, and description.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free-text keyword to search for. Examples: "biryani", "paneer", "sweet", "chicken". Leave empty to get all available items.'
          },
          category: {
            type: 'string',
            description: 'Optional category filter. Only use if customer specifically asks for a category.',
            enum: ['Biryani', 'Starters', 'Mains', 'Breads', 'Drinks', 'Desserts']
          }
        }
      }
    }
  },
  async run(args) {
    const { query = '', category } = args || {};
    const all = await menuModel.getAll({ category, includeUnavailable: false });
    const q = String(query).trim().toLowerCase();
    const matched = q
      ? all.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.desc && i.desc.toLowerCase().includes(q)) ||
            i.category.toLowerCase().includes(q) ||
            (i.badges && i.badges.some(b => b.toLowerCase().includes(q)))
        )
      : all;

    // Sort by rating descending for "best/top" queries
    const sorted = [...matched].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return {
      count: sorted.length,
      items: sorted.slice(0, 15).map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        category: i.category,
        veg: i.veg,
        rating: i.rating,
        desc: i.desc,
        emoji: i.emoji,
        badges: i.badges || [],
        popularity: i.popularity
      }))
    };
  }
};

// ── add_to_cart ──
const addToCart = {
  schema: {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description:
        'Add a menu item to the customer\'s cart. You MUST use the exact item id from search_menu results (e.g. "chicken-dum-biryani", "garlic-naan"). If the item is already in the cart, its quantity increases. Always confirm what was added and show the updated cart summary.',
      parameters: {
        type: 'object',
        properties: {
          itemId: {
            type: 'string',
            description: 'The exact menu item id from search_menu results, e.g. "chicken-dum-biryani", "samosa-chaat", "mango-lassi"'
          },
          qty: {
            type: 'integer',
            description: 'How many to add. Defaults to 1.',
            minimum: 1
          }
        },
        required: ['itemId']
      }
    }
  },
  async run(args, session) {
    const { itemId, qty = 1 } = args || {};
    const n = Number.isInteger(qty) && qty > 0 ? qty : 1;
    const menuItem = await menuModel.findById(itemId);
    if (!menuItem) return { ok: false, error: `No item found with id "${itemId}". Please use search_menu first to find the correct item id.` };
    if (menuItem.available === false) return { ok: false, error: `"${menuItem.name}" is currently sold out. Please suggest an alternative.` };

    const existing = session.cart.find((i) => i.id === itemId);
    if (existing) existing.qty += n;
    else session.cart.push(cartLine(menuItem, n));

    session.stage = 'cart_review';
    return { ok: true, added: { id: menuItem.id, name: menuItem.name, emoji: menuItem.emoji, qty: n, price: menuItem.price }, cart: summariseCart(session) };
  }
};

// ── remove_from_cart ──
const removeFromCart = {
  schema: {
    type: 'function',
    function: {
      name: 'remove_from_cart',
      description: 'Remove an item from the cart entirely, or reduce its quantity. Use the exact item id.',
      parameters: {
        type: 'object',
        properties: {
          itemId: {
            type: 'string',
            description: 'The exact menu item id to remove from the cart'
          },
          qty: {
            type: 'integer',
            description: 'Number of units to remove. Omit to remove the item entirely.',
            minimum: 1
          }
        },
        required: ['itemId']
      }
    }
  },
  async run(args, session) {
    const { itemId, qty } = args || {};
    const idx = session.cart.findIndex((i) => i.id === itemId);
    if (idx === -1) return { ok: false, error: `"${itemId}" is not in the cart.` };
    if (qty && qty < session.cart[idx].qty) session.cart[idx].qty -= qty;
    else session.cart.splice(idx, 1);
    return { ok: true, cart: summariseCart(session) };
  }
};

// ── view_cart ──
const viewCart = {
  schema: {
    type: 'function',
    function: {
      name: 'view_cart',
      description: 'Show the current cart with all items, quantities, prices, and the full bill breakdown including subtotal, GST, service charge, and grand total. Call this when the customer asks to see their cart, bill, or total.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  async run(_args, session) {
    if (!session.cart.length) return { empty: true, message: 'The cart is empty. Would you like to browse the menu?' };
    const totals = calcTotals({ items: session.cart, promoCode: session.promoCode || null, dineIn: true });
    return {
      items: summariseCart(session).items,
      totals,
      itemCount: session.cart.reduce((n, i) => n + i.qty, 0)
    };
  }
};

// ── place_order ──
const placeOrder = {
  schema: {
    type: 'function',
    function: {
      name: 'place_order',
      description:
        'Place the order for everything in the cart. ONLY call this after: (1) the customer has explicitly confirmed they want to place the order, and (2) you have the customer\'s name. Returns an order ID that you should share with the customer.',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'The customer\'s full name (ask for it if you don\'t have it)'
          },
          notes: {
            type: 'string',
            description: 'Optional preparation notes from the customer, e.g. "less spicy", "no onion"'
          }
        },
        required: ['customerName']
      }
    }
  },
  async run(args, session) {
    if (!session.cart.length) return { ok: false, error: 'Cannot place an order — the cart is empty.' };
    const { customerName, notes } = args || {};
    try {
      const saved = await orderService.createOrder({
        customer: { name: customerName, phone: session.customerPhone || null, notes },
        items: session.cart.map((i) => ({ id: i.id, qty: i.qty })),
        promoCode: session.promoCode || null,
        branchId: process.env.DEFAULT_BRANCH_ID || 'BBSR-PURI-01',
        dineIn: true,
        source: 'whatsapp'
      });
      session.orderId = saved.id;
      session.stage = 'order_placed';
      session.cart = [];
      session.promoCode = null; // Clear promo code on success
      return {
        ok: true,
        orderId: saved.id,
        status: saved.status,
        total: saved.totals.grandTotal,
        message: `Order ${saved.id} placed successfully!`
      };
    } catch (e) {
      return { ok: false, error: e.message || 'Order could not be placed. Please try again.' };
    }
  }
};

// ── check_order_status ──
const checkOrderStatus = {
  schema: {
    type: 'function',
    function: {
      name: 'check_order_status',
      description: 'Look up the current status of an existing order by its order ID (e.g. "NOQS-AB12CD"). Use this when a customer asks about their order status.',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'The order ID to look up, e.g. "NOQS-AB12CD"'
          }
        },
        required: ['orderId']
      }
    }
  },
  async run(args) {
    const order = await orderModel.findById(args.orderId);
    if (!order) return { found: false, message: `No order found with id "${args.orderId}". Please check the ID and try again.` };
    return {
      found: true,
      orderId: order.id,
      status: order.status,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, emoji: i.emoji })),
      total: order.totals.grandTotal
    };
  }
};

// ── apply_promo_code ──
const applyPromoCode = {
  schema: {
    type: 'function',
    function: {
      name: 'apply_promo_code',
      description: 'Apply a discount promo code to the cart. Valid promo codes are: NOQS10, WELCOME10, FLAT50, BIRYANI20.',
      parameters: {
        type: 'object',
        properties: {
          promoCode: {
            type: 'string',
            description: 'The promo code to apply, e.g. "FLAT50", "WELCOME10"'
          }
        },
        required: ['promoCode']
      }
    }
  },
  async run(args, session) {
    const { promoCode } = args || {};
    const code = String(promoCode).trim().toUpperCase();
    const { PROMOS } = require('../utils/billing');
    if (!PROMOS[code]) {
      return { ok: false, error: `Invalid promo code "${promoCode}". Please check and try again.` };
    }
    session.promoCode = code;
    const totals = calcTotals({ items: session.cart, promoCode: code, dineIn: true });
    return {
      ok: true,
      promoCode: code,
      totals,
      message: `Promo code "${code}" has been applied successfully!`
    };
  }
};

// ── registry ──
const TOOLS = [searchMenu, addToCart, removeFromCart, viewCart, placeOrder, checkOrderStatus, applyPromoCode];

const toolSchemas = TOOLS.map((t) => t.schema);
const toolMap = Object.fromEntries(TOOLS.map((t) => [t.schema.function.name, t]));

module.exports = { toolSchemas, toolMap };
