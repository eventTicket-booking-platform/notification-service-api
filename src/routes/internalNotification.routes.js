const express = require("express");

const controller = require("../controllers/internalNotification.controller");
const {
  validateEmailVerificationOtp,
  validatePasswordResetOtp,
  validateBookingConfirmed,
  validateBookingCancelled,
  validateGeneralAlert,
} = require("../validators/notification.validator");

const router = express.Router();

// Send email verification OTP notification
router.post(
  "/email-verification-otp",
  validateEmailVerificationOtp,
  controller.sendEmailVerificationOtp,
);

// Send password reset OTP notification
router.post(
  "/password-reset-otp",
  validatePasswordResetOtp,
  controller.sendPasswordResetOtp,
);

// Send booking confirmed notification
router.post(
  "/booking-confirmed",
  validateBookingConfirmed,
  controller.sendBookingConfirmed,
);

// Send booking cancelled notification
router.post(
  "/booking-cancelled",
  validateBookingCancelled,
  controller.sendBookingCancelled,
);

// Send general alert notification
router.post(
  "/general-alert",
  validateGeneralAlert,
  controller.sendGeneralAlert,
);

module.exports = router;
