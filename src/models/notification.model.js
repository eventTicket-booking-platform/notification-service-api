const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        'EMAIL_VERIFICATION_OTP',
        'PASSWORD_RESET_OTP',
        'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED',
        'GENERAL_ALERT',
        'HOST_PASSWORD'
      ]
    },
    channel: {
      type: String,
      default: 'EMAIL'
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING'
    },
    isRead: {
      type: Boolean,
      default: false
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    failureReason: {
      type: String,
      default: null
    },
    provider: {
      type: String,
      default: 'BREVO'
    },
    providerMessageId: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ status: 1, type: 1, createdAt: -1 });
notificationSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
