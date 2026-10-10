const notificationService = require("../services/notification.service");
const { getRabbitChannel, AUTH_NOTIFICATION_QUEUE } = require("../config/rabbitmq");

async function startAuthNotificationConsumer() {
  const channel = getRabbitChannel();
  await channel.assertQueue(AUTH_NOTIFICATION_QUEUE, { durable: true });
  channel.prefetch(10);

  await channel.consume(AUTH_NOTIFICATION_QUEUE, async (message) => {
    if (!message) {
      return;
    }

    try {
      const rawBody = message.content.toString();
      const event = JSON.parse(rawBody);
      await handleAuthNotificationEvent(event);
      channel.ack(message);
    } catch (error) {
      console.error("Failed to process auth notification event:", error.message);
      channel.nack(message, false, false);
    }
  });

  console.log(`Auth notification consumer started on queue: ${AUTH_NOTIFICATION_QUEUE}`);
}

async function handleAuthNotificationEvent(event) {
  const type = event?.type;
  const payload = event?.payload || {};

  if (type === "HOST_APPLICATION_APPROVED" || type === "HOST_APPLICATION_REJECTED") {
    ensureRequired(payload, ["email", "firstName", "organizationName"]);
    for (const field of ["email", "firstName", "organizationName"]) {
      if (typeof payload[field] !== "string" || !payload[field].trim()) {
        throw new Error(`Payload field ${field} must be a non-empty string`);
      }
    }
    if (type === "HOST_APPLICATION_REJECTED" && payload.rejectionReason != null && typeof payload.rejectionReason !== "string") {
      throw new Error("Payload field rejectionReason must be a string");
    }
    const notificationPayload = {
      name: payload.firstName,
      organizationName: payload.organizationName,
    };
    if (type === "HOST_APPLICATION_REJECTED") notificationPayload.rejectionReason = payload.rejectionReason;
    await notificationService.sendNotification({ email: payload.email, type, payload: notificationPayload });
    return;
  }

  if (type === "EMAIL_VERIFICATION_OTP") {
    ensureRequired(payload, ["userId", "email", "otp"]);
    await notificationService.sendNotification({
      userId: payload.userId,
      email: payload.email,
      type: "EMAIL_VERIFICATION_OTP",
      payload: {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        otp: payload.otp,
      },
    });
    return;
  }

  if (type === "PASSWORD_RESET_OTP") {
    ensureRequired(payload, ["userId", "email", "otp"]);
    await notificationService.sendNotification({
      userId: payload.userId,
      email: payload.email,
      type: "PASSWORD_RESET_OTP",
      payload: {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        otp: payload.otp,
      },
    });
    return;
  }

  if (type === "HOST_PASSWORD") {
    ensureRequired(payload, ["email", "password", "firstName"]);
    await notificationService.sendHostPassword({
      email: payload.email,
      password: payload.password,
      firstName: payload.firstName,
    });
    return;
  }

  throw new Error(`Unsupported auth notification event type: ${type}`);
}

function ensureRequired(payload, fields) {
  const missing = fields.filter((field) => !payload[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required payload fields: ${missing.join(", ")}`);
  }
}

module.exports = {
  startAuthNotificationConsumer,
};
