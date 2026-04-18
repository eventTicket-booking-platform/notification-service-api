const notificationService = require("../services/notification.service");
const { getRabbitChannel, BOOKING_NOTIFICATION_QUEUE } = require("../config/rabbitmq");

async function startBookingNotificationConsumer() {
  const channel = getRabbitChannel();
  await channel.assertQueue(BOOKING_NOTIFICATION_QUEUE, { durable: true });
  channel.prefetch(10);

  await channel.consume(BOOKING_NOTIFICATION_QUEUE, async (message) => {
    if (!message) {
      return;
    }

    try {
      const rawBody = message.content.toString();
      const event = JSON.parse(rawBody);
      await handleBookingNotificationEvent(event);
      channel.ack(message);
    } catch (error) {
      console.error("Failed to process booking notification event:", error.message);
      channel.nack(message, false, false);
    }
  });

  console.log(`Booking notification consumer started on queue: ${BOOKING_NOTIFICATION_QUEUE}`);
}

async function handleBookingNotificationEvent(event) {
  const type = event?.type;
  const payload = event?.payload || {};

  if (type === "BOOKING_CONFIRMED") {
    ensureRequired(payload, ["email", "bookingId", "eventTitle"]);
    await notificationService.sendNotification({
      userId: payload.userId,
      email: payload.email,
      type: "BOOKING_CONFIRMED",
      payload: {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        bookingId: payload.bookingId,
        eventTitle: payload.eventTitle,
        bookingDate: payload.bookingDate,
      },
    });
    return;
  }

  throw new Error(`Unsupported booking notification event type: ${type}`);
}

function ensureRequired(payload, fields) {
  const missing = fields.filter((field) => !payload[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required payload fields: ${missing.join(", ")}`);
  }
}

module.exports = {
  startBookingNotificationConsumer,
};
