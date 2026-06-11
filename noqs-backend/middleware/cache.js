/**
 * Cache-Aside middleware for GET endpoints.
 *
 *   router.get('/menu',
 *     cacheRead(req => `menu:list:${req.query.category || 'all'}`, 300),
 *     menuController.getMenu);
 *
 * The controller writes its response via res.json(...). We wrap res.json
 * so that, on a cache miss, the response is also written back to Redis.
 */

const { getJSON, setJSON } = require('../cache/redisClient');

const DEFAULT_TTL = Number(process.env.MENU_CACHE_TTL || 300);

function cacheRead(keyBuilder, ttlSeconds = DEFAULT_TTL) {
  return async function (req, res, next) {
    if (process.env.CACHE_DISABLED === '1') return next();

    let key;
    try { key = keyBuilder(req); }
    catch { return next(); }
    if (!key) return next();

    const cached = await getJSON(key);
    if (cached !== null) {
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', key);
      return res.status(200).json(cached);
    }

    // Miss → intercept res.json to populate the cache after handler runs
    res.set('X-Cache', 'MISS');
    res.set('X-Cache-Key', key);
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // fire-and-forget; never block the response
        setJSON(key, body, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { cacheRead, DEFAULT_TTL };
