const successResponse = (code, message, data = null) => ({
  code,
  message,
  data
});

const errorResponse = (code, message, data = null) => ({
  code,
  message,
  data
});

module.exports = {
  successResponse,
  errorResponse
};
