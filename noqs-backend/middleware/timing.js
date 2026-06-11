/**
 * High-resolution request timer.
 * Logs per-route elapsed time + flags slow requests above SLOW_REQ_MS.
 * Also exposes res.locals.t0 in case downstream middleware wants it.
 */

const SLOW_REQ_MS = Number(process.env.SLOW_REQ_MS || 250);

function timing(req, res, next) {
  const t0 = process.hrtime.bigint();
  res.locals.t0 = t0;

  res.on('finish', () => {
    const ns = Number(process.hrtime.bigint() - t0);
    const ms = ns / 1e6;
    const slow = ms >= SLOW_REQ_MS ? ' ⚠ SLOW' : '';
    const cache = res.getHeader('X-Cache') || '-';
    console.log(
      `[perf] ${req.method} ${req.originalUrl} ` +
      `→ ${res.statusCode} ${ms.toFixed(2)}ms cache=${cache}${slow}`
    );
  });

  next();
}

module.exports = timing;
