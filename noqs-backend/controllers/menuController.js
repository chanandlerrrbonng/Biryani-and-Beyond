const menuModel = require('../models/menuModel');
const { getJSON, setJSON, del, delPattern } = require('../cache/redisClient');

const MENU_TTL = Number(process.env.MENU_CACHE_TTL || 300);

function listKey(category, includeUnavailable) {
  return `menu:list:${(category || 'all').toLowerCase()}:${includeUnavailable ? 'all' : 'avail'}`;
}
function itemKey(id) { return `menu:item:${id}`; }

// Owners/staff see unavailable items too; public + customers do not.
function wantsAll(req) {
  return !!(req.user && (req.user.role === 'owner' || req.user.role === 'staff'));
}

exports.getMenu = async (req, res, next) => {
  try {
    const { category } = req.query;
    const includeUnavailable = wantsAll(req);
    const key = listKey(category, includeUnavailable);

    const cached = await getJSON(key);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const items = await menuModel.getAll({ category, includeUnavailable });
    res.set('X-Cache', 'MISS');
    setJSON(key, items, MENU_TTL).catch(() => {});
    res.status(200).json(items);
  } catch (err) {
    next(err);
  }
};

exports.getMenuItem = async (req, res, next) => {
  try {
    const key = itemKey(req.params.id);
    const cached = await getJSON(key);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }
    const item = await menuModel.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Not Found', message: `Menu item '${req.params.id}' does not exist` });
    }
    res.set('X-Cache', 'MISS');
    setJSON(key, item, MENU_TTL).catch(() => {});
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
};

exports.createMenuItem = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.id || !body.name || !body.category || typeof body.price !== 'number') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id, name, category and numeric price are required'
      });
    }
    const existing = await menuModel.findById(body.id);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: `Menu item '${body.id}' already exists` });
    }
    const created = await menuModel.create(body);
    await delPattern('menu:list:*');
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

exports.updateMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await menuModel.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: `Menu item '${id}' does not exist` });
    }
    const updated = await menuModel.update(id, req.body || {});
    await Promise.all([del(itemKey(id)), delPattern('menu:list:*')]);
    res.set('X-Cache-Invalidated', `${itemKey(id)},menu:list:*`);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

exports.setAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { available } = req.body || {};
    if (typeof available !== 'boolean') {
      return res.status(400).json({ error: 'Bad Request', message: 'available (boolean) is required' });
    }
    const existing = await menuModel.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: `Menu item '${id}' does not exist` });
    }
    const updated = await menuModel.setAvailability(id, available);
    await Promise.all([del(itemKey(id)), delPattern('menu:list:*')]);
    res.set('X-Cache-Invalidated', `${itemKey(id)},menu:list:*`);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteMenuItem = async (req, res, next) => {
  try {
    const ok = await menuModel.remove(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Not Found', message: `Menu item '${req.params.id}' does not exist` });
    }
    await Promise.all([del(itemKey(req.params.id)), delPattern('menu:list:*')]);
    res.status(200).json({ ok: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
};

exports.setStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stockCount } = req.body || {};
    if (!Number.isInteger(stockCount) || stockCount < 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'stockCount must be a non-negative integer' });
    }
    const existing = await menuModel.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: `Menu item '${id}' does not exist` });
    }
    const updated = await menuModel.setStock(id, stockCount);
    await Promise.all([del(itemKey(id)), delPattern('menu:list:*')]);
    res.set('X-Cache-Invalidated', `${itemKey(id)},menu:list:*`);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};
