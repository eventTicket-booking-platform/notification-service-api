const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const buildValidationMiddleware = (rules) => (req, res, next) => {
  const errors = [];

  rules.forEach((rule) => {
    const value = req.body[rule.field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${rule.field} is required`);
      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      if (rule.type === 'email' && !isValidEmail(value)) {
        errors.push(`${rule.field} must be a valid email`);
      }

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${rule.field} must be a string`);
      }
    }
  });

  if (errors.length > 0) {
    const error = new Error('Validation failed');
    error.statusCode = 400;
    error.exposeMessage = 'Validation failed';
    error.details = { errors };
    return next(error);
  }

  return next();
};

const commonUserRules = [
  { field: 'userId', required: true, type: 'string' },
  { field: 'email', required: true, type: 'email' }
];

const validateEmailVerificationOtp = buildValidationMiddleware([
  ...commonUserRules,
  { field: 'name', required: false, type: 'string' },
  { field: 'otp', required: true, type: 'string' }
]);

const validatePasswordResetOtp = buildValidationMiddleware([
  ...commonUserRules,
  { field: 'name', required: false, type: 'string' },
  { field: 'otp', required: true, type: 'string' }
]);

const validateBookingConfirmed = buildValidationMiddleware([
  ...commonUserRules,
  { field: 'name', required: false, type: 'string' },
  { field: 'bookingId', required: true, type: 'string' },
  { field: 'eventTitle', required: true, type: 'string' },
  { field: 'bookingDate', required: true, type: 'string' }
]);

const validateBookingCancelled = buildValidationMiddleware([
  ...commonUserRules,
  { field: 'name', required: false, type: 'string' },
  { field: 'bookingId', required: true, type: 'string' },
  { field: 'eventTitle', required: true, type: 'string' }
]);

module.exports = {
  validateEmailVerificationOtp,
  validatePasswordResetOtp,
  validateBookingConfirmed,
  validateBookingCancelled
};
