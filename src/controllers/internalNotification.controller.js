const notificationService = require('../services/notification.service');
const { successResponse } = require('../utils/apiResponse');

class InternalNotificationController {
  async sendEmailVerificationOtp(req, res, next) {
    try {
      const notification = await notificationService.sendNotification({
        userId: req.body.userId,
        email: req.body.email,
        type: 'EMAIL_VERIFICATION_OTP',
        payload: {
          userId: req.body.userId,
          email: req.body.email,
          name: req.body.name,
          otp: req.body.otp
        }
      });

      return res
        .status(200)
        .json(successResponse(200, 'Email verification OTP sent successfully', notification));
    } catch (error) {
      return next(error);
    }
  }

  async sendPasswordResetOtp(req, res, next) {
    try {
      const notification = await notificationService.sendNotification({
        userId: req.body.userId,
        email: req.body.email,
        type: 'PASSWORD_RESET_OTP',
        payload: {
          userId: req.body.userId,
          email: req.body.email,
          name: req.body.name,
          otp: req.body.otp
        }
      });

      return res
        .status(200)
        .json(successResponse(200, 'Password reset OTP sent successfully', notification));
    } catch (error) {
      return next(error);
    }
  }

  async sendBookingConfirmed(req, res, next) {
    try {
      const notification = await notificationService.sendNotification({
        userId: req.body.userId,
        email: req.body.email,
        type: 'BOOKING_CONFIRMED',
        payload: {
          userId: req.body.userId,
          email: req.body.email,
          name: req.body.name,
          bookingId: req.body.bookingId,
          eventTitle: req.body.eventTitle,
          bookingDate: req.body.bookingDate
        }
      });

      return res
        .status(200)
        .json(successResponse(200, 'Booking confirmation email sent successfully', notification));
    } catch (error) {
      return next(error);
    }
  }

  async sendBookingCancelled(req, res, next) {
    try {
      const notification = await notificationService.sendNotification({
        userId: req.body.userId,
        email: req.body.email,
        type: 'BOOKING_CANCELLED',
        payload: {
          userId: req.body.userId,
          email: req.body.email,
          name: req.body.name,
          bookingId: req.body.bookingId,
          eventTitle: req.body.eventTitle
        }
      });

      return res
        .status(200)
        .json(successResponse(200, 'Booking cancellation email sent successfully', notification));
    } catch (error) {
      return next(error);
    }
  }

  async sendGeneralAlert(req, res, next) {
    try {
      const notification = await notificationService.sendNotification({
        userId: req.body.userId,
        email: req.body.email,
        type: 'GENERAL_ALERT',
        payload: {
          userId: req.body.userId,
          email: req.body.email,
          subject: req.body.subject,
          message: req.body.message
        }
      });

      return res
        .status(200)
        .json(successResponse(200, 'General alert email sent successfully', notification));
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new InternalNotificationController();
