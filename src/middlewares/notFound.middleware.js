const { errorResponse } = require('../utils/apiResponse');

function notFoundMiddleware(req, res) {
  return res.status(404).json(errorResponse(404, `Route not found: ${req.originalUrl}`));
}

module.exports = notFoundMiddleware;
