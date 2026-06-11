const menuModel = require('../models/menuModel');
const { getJSON, setJSON, del, delPattern } = require('../cache/redisClient');

const MENU_TTL = Number(process.env.MENU_CACHE_TTL || 300);

function listKey(category)  { return `menu:list:${(category || 'all').toLowerCase()}`; }
function itemKey(id)        { return `menu:item:${id}`; }

exports.getMenu = async (req, res, next) => {
  try {
    const { category } = req.query;
    const key = listKey(category);

    // Cache-Aside read
    const cached = await getJSON(key);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const items = await menuModel.getAll({ category });
    res.set('X-Cache', 'MISS');
    // populate cache (fire-and-forget; never block the response)
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
      return res.status(404).json({
        error: 'Not Found',
        message: `Menu item '${req.params.id}' does not exist`
      });
    }
    res.set('X-Cache', 'MISS');
    setJSON(key, item, MENU_TTL).catch(() => {});
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
};

// ── Task 616 Phase 3: write path → invalidate ──
exports.updateMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await menuModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Menu item '${id}' does not exist`
      });
    }

    const patch = req.body || {};
    const updated = await menuModel.update(id, patch);

    // Invalidate this item + ALL list variants (per-category + 'all')
    await Promise.all([
      del(itemKey(id)),
      delPattern('menu:list:*')
    ]);

    res.set('X-Cache-Invalidated', `${itemKey(id)},menu:list:*`);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};
