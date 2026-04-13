const { errorResponse } = require('../utils/apiResponse');

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message =
    err.exposeMessage ||
    (statusCode >= 500 ? 'Internal server error' : err.message || 'Request failed');

  if (statusCode >= 500) {
    console.error(err);
  }

  const data =
    process.env.NODE_ENV !== 'production' && err.details ? { details: err.details } : null;

  return res.status(statusCode).json(errorResponse(statusCode, message, data));
}

module.exports = errorMiddleware;
