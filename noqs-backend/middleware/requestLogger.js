/**
 * Minimal request logger — prints method, path, status, and duration.
 * Helpful during development; remove or replace with morgan/pino in prod.
 */

function requestLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - started;
    const tag = res.statusCode >= 500 ? '✗' : res.statusCode >= 400 ? '!' : '✓';
    console.log(`${tag} ${req.method.padEnd(4)} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
}

module.exports = requestLogger;
