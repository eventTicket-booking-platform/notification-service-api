const express = require('express');

const controller = require('../controllers/internalNotification.controller');
const {
  validateEmailVerificationOtp,
  validatePasswordResetOtp,
  validateBookingConfirmed,
  validateBookingCancelled,
  validateGeneralAlert
} = require('../validators/notification.validator');

const router = express.Router();

router.post('/send-email-verification-otp', validateEmailVerificationOtp, controller.sendEmailVerificationOtp);
router.post('/send-password-reset-otp', validatePasswordResetOtp, controller.sendPasswordResetOtp);
router.post('/booking-confirmed', validateBookingConfirmed, controller.sendBookingConfirmed);
router.post('/booking-cancelled', validateBookingCancelled, controller.sendBookingCancelled);
router.post('/general-alert', validateGeneralAlert, controller.sendGeneralAlert);

module.exports = router;
