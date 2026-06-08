/**
 * Centralised error handler. Express recognises this as an error
 * middleware because it has 4 arguments.
 */

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err.message || err);

  // Body-parser malformed JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body is not valid JSON'
    });
  }

  res.status(err.status || 500).json({
    error: err.status === 400 ? 'Bad Request' : 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
}

module.exports = errorHandler;
