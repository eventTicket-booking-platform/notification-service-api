const mongoose = require("mongoose");

const Notification = require("../models/notification.model");
const brevoEmailService = require("./brevoEmail.service");

class NotificationService {
  ensureValidId(notificationId) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      const error = new Error("Invalid notification id");
      error.statusCode = 400;
      error.exposeMessage = "Invalid notification id";
      throw error;
    }
  }

  buildEmailContent(type, payload) {
    const name = payload.name || "User";

    switch (type) {
      case "EMAIL_VERIFICATION_OTP": {
        const subject = "Verify your Event Hub email";
        const message = `Hello ${name}, your Event Hub email verification OTP is ${payload.otp}. This OTP will expire soon.`;
        return {
          subject,
          message,
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937;">
              <h2>Verify your email</h2>
              <p>Hello ${name},</p>
              <p>Your Event Hub email verification OTP is:</p>
              <h1 style="letter-spacing: 4px;">${payload.otp}</h1>
              <p>This OTP will expire soon.</p>
            </div>
          `,
        };
      }
      case "PASSWORD_RESET_OTP": {
        const subject = "Reset your Event Hub password";
        const message = `Hello ${name}, your Event Hub password reset OTP is ${payload.otp}. If you did not request this, please ignore this email.`;
        return {
          subject,
          message,
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937;">
              <h2>Password reset request</h2>
              <p>Hello ${name},</p>
              <p>Your password reset OTP is:</p>
              <h1 style="letter-spacing: 4px;">${payload.otp}</h1>
              <p>If you did not request this, you can safely ignore this email.</p>
            </div>
          `,
        };
      }
      case "BOOKING_CONFIRMED": {
        const bookingDate = payload.bookingDate
          ? new Date(payload.bookingDate).toLocaleString("en-US", {
              timeZone: "UTC",
            })
          : "N/A";
        const subject = `Booking confirmed: ${payload.eventTitle}`;
        const message = `Hello ${name}, your booking ${payload.bookingId} for ${payload.eventTitle} is confirmed. Event date: ${bookingDate}.`;
        return {
          subject,
          message,
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937;">
              <h2>Booking confirmed</h2>
              <p>Hello ${name},</p>
              <p>Your booking has been confirmed successfully.</p>
              <p><strong>Booking ID:</strong> ${payload.bookingId}</p>
              <p><strong>Event:</strong> ${payload.eventTitle}</p>
              <p><strong>Booking Date:</strong> ${bookingDate}</p>
            </div>
          `,
        };
      }
      case "BOOKING_CANCELLED": {
        const subject = `Booking cancelled: ${payload.eventTitle}`;
        const message = `Hello ${name}, your booking ${payload.bookingId} for ${payload.eventTitle} has been cancelled.`;
        return {
          subject,
          message,
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937;">
              <h2>Booking cancelled</h2>
              <p>Hello ${name},</p>
              <p>Your booking has been cancelled.</p>
              <p><strong>Booking ID:</strong> ${payload.bookingId}</p>
              <p><strong>Event:</strong> ${payload.eventTitle}</p>
            </div>
          `,
        };
      }
      case "GENERAL_ALERT": {
        return {
          subject: payload.subject,
          message: payload.message,
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937;">
              <h2>${payload.subject}</h2>
              <p>${payload.message}</p>
            </div>
          `,
        };
      }
      default: {
        const error = new Error("Unsupported notification type");
        error.statusCode = 400;
        error.exposeMessage = "Unsupported notification type";
        throw error;
      }
    }
  }

  async sendNotification({ userId, email, type, payload }) {
    const emailContent = this.buildEmailContent(type, payload);

    const notification = await Notification.create({
      userId: userId || null,
      email,
      type,
      subject: emailContent.subject,
      message: emailContent.message,
      metadata: payload,
    });

    try {
      const providerResponse = await brevoEmailService.sendTransactionalEmail({
        to: {
          email,
          name: payload.name,
        },
        subject: emailContent.subject,
        textContent: emailContent.message,
        htmlContent: emailContent.html,
      });

      notification.status = "SENT";
      notification.failureReason = null;
      notification.provider = providerResponse.provider;
      notification.providerMessageId = providerResponse.providerMessageId;
      await notification.save();

      return notification;
    } catch (error) {
      notification.status = "FAILED";
      notification.failureReason =
        error?.details?.message || error?.message || "Notification send failed";
      await notification.save();

      error.notificationId = notification._id;
      throw error;
    }
  }

  async getUserNotifications(userId) {
    return Notification.find({ userId }).sort({ createdAt: -1 });
  }

  async getUserNotificationById(userId, notificationId) {
    this.ensureValidId(notificationId);
    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      const error = new Error("Notification not found");
      error.statusCode = 404;
      error.exposeMessage = "Notification not found";
      throw error;
    }

    return notification;
  }

  async markAsRead(userId, notificationId) {
    this.ensureValidId(notificationId);
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      const error = new Error("Notification not found");
      error.statusCode = 404;
      error.exposeMessage = "Notification not found";
      throw error;
    }

    return notification;
  }

  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true },
    );

    return {
      modifiedCount: result.modifiedCount || 0,
    };
  }

  async getNotificationLogs({ page = 1, limit = 10, type, status, email }) {
    const query = {};

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (email) {
      query.email = { $regex: email, $options: "i" };
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getFailedNotifications() {
    return Notification.find({ status: "FAILED" }).sort({ createdAt: -1 });
  }

  async retryFailedNotification(notificationId) {
    this.ensureValidId(notificationId);
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      const error = new Error("Notification not found");
      error.statusCode = 404;
      error.exposeMessage = "Notification not found";
      throw error;
    }

    if (notification.status !== "FAILED") {
      const error = new Error("Only failed notifications can be retried");
      error.statusCode = 400;
      error.exposeMessage = "Only failed notifications can be retried";
      throw error;
    }

    notification.status = "PENDING";
    notification.failureReason = null;
    await notification.save();

    try {
      const providerResponse = await brevoEmailService.sendTransactionalEmail({
        to: {
          email: notification.email,
          name: notification.metadata?.name,
        },
        subject: notification.subject,
        textContent: notification.message,
        htmlContent: this.buildEmailContent(
          notification.type,
          notification.metadata,
        ).html,
      });

      notification.status = "SENT";
      notification.provider = providerResponse.provider;
      notification.providerMessageId = providerResponse.providerMessageId;
      notification.failureReason = null;
      await notification.save();

      return notification;
    } catch (error) {
      notification.status = "FAILED";
      notification.failureReason =
        error?.details?.message ||
        error?.message ||
        "Notification retry failed";
      await notification.save();
      throw error;
    }
  }

  async getStats() {
    const [totalNotifications, sentCount, failedCount, unreadCount] =
      await Promise.all([
        Notification.countDocuments(),
        Notification.countDocuments({ status: "SENT" }),
        Notification.countDocuments({ status: "FAILED" }),
        Notification.countDocuments({ isRead: false }),
      ]);

    return {
      totalNotifications,
      sentCount,
      failedCount,
      unreadCount,
    };
  }

  async sendHostPassword({ email, password, firstName }) {
    const fixedMessage = "Access your system by using the above password";
    const emailContent = {
      subject: "Host System Access - Credentials",
      message: `Hello ${firstName}, ${fixedMessage}\nEmail: ${email}\nPassword: ${password}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937;">
          <h2>Host System Access</h2>
          <p>Hello ${firstName},</p>
          <p>${fixedMessage}</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> <code style="background-color: #e5e7eb; padding: 4px 8px;">${password}</code></p>
          </div>
          <p style="color: #6b7280; font-size: 12px;">Please change your password after your first login.</p>
        </div>
      `,
    };

    const notification = await Notification.create({
      email,
      type: "HOST_PASSWORD",
      subject: emailContent.subject,
      message: emailContent.message,
      channel: "EMAIL",
      metadata: { firstName, password },
    });

    try {
      const providerResponse = await brevoEmailService.sendTransactionalEmail({
        to: {
          email,
          name: firstName,
        },
        subject: emailContent.subject,
        textContent: emailContent.message,
        htmlContent: emailContent.html,
      });

      notification.status = "SENT";
      notification.failureReason = null;
      notification.provider = providerResponse.provider;
      notification.providerMessageId = providerResponse.providerMessageId;
      await notification.save();

      return notification;
    } catch (error) {
      notification.status = "FAILED";
      notification.failureReason =
        error?.details?.message ||
        error?.message ||
        "Failed to send host password";
      await notification.save();
      throw error;
    }
  }
}

module.exports = new NotificationService();
