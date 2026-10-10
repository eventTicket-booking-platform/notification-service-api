const notificationService = require("../services/notification.service");
const ProcessedEvent = require("../models/processedEvent.model");
const {
  getRabbitChannel,
  BOOKING_NOTIFICATION_QUEUE,
  BOOKING_NOTIFICATION_RETRY_QUEUE,
  BOOKING_NOTIFICATION_DLQ,
} = require("../config/rabbitmq");
const MAX_DELIVERY_ATTEMPTS = 3;

class PermanentMessageError extends Error {
  constructor(message) {
    super(message);
    this.name = "PermanentMessageError";
  }
}

async function startBookingNotificationConsumer() {
  const channel = getRabbitChannel();

  channel.prefetch(10);

  await channel.consume(
      BOOKING_NOTIFICATION_QUEUE,
      async (message) => {
        if (!message) {
          return;
        }

        const headers =
            message.properties.headers || {};

        const attempt =
            Number(headers["x-attempt"] || 1);

        let correlationId =
            headers["x-correlation-id"] || "unknown";

        try {
          const rawBody =
              message.content.toString();

          let event;
          try {
            event = JSON.parse(rawBody);
          } catch (error) {
            throw new PermanentMessageError(`Invalid JSON: ${error.message}`);
          }

          const eventId = event?.eventId;

          correlationId =
              event?.correlationId ||
              event?.payload?.correlationId ||
              correlationId;

          if (!eventId) {
            throw new PermanentMessageError("Missing required eventId");
          }

          if (typeof eventId !== "string" || !eventId.trim()) {
            throw new PermanentMessageError("eventId must be a non-empty string");
          }

          console.log(
              `Processing booking notification eventId=${eventId} correlationId=${correlationId}`
          );
          await handleBookingNotificationEvent(
              event,
              eventId,
              correlationId
          );

          channel.ack(message);

        } catch (error) {

          console.error(
              `Failed booking notification correlationId=${correlationId} attempt ${attempt}/${MAX_DELIVERY_ATTEMPTS}:`,
              error.message
          );

          const isPermanent = error instanceof PermanentMessageError;

          if (!isPermanent && attempt < MAX_DELIVERY_ATTEMPTS) {

            channel.sendToQueue(
                BOOKING_NOTIFICATION_RETRY_QUEUE,
                message.content,
                {
                  persistent: true,

                  contentType:
                      message.properties.contentType ||
                      "application/json",

                  headers: {
                    ...headers,
                    "x-correlation-id": correlationId,
                    "x-attempt": attempt + 1,
                  },
                }
            );

            console.warn(
                `Message moved to retry queue. Next attempt: ${attempt + 1}`
            );

          } else {

            channel.sendToQueue(
                BOOKING_NOTIFICATION_DLQ,
                message.content,
                {
                  persistent: true,

                  contentType:
                      message.properties.contentType ||
                      "application/json",

                  headers: {
                    ...headers,
                    "x-correlation-id": correlationId,
                    "x-attempt": attempt,
                    "x-failure-reason":
                    error.message,
                    "x-failure-type": isPermanent
                        ? "PERMANENT"
                        : "TRANSIENT_MAX_RETRIES",
                  },
                }
            );

            console.error(
                isPermanent
                    ? "Permanent failure. Message moved to DLQ."
                    : "Maximum attempts reached. Message moved to DLQ."
            );
          }
          channel.ack(message);
        }
      }
  );

  console.log(
      `Booking notification consumer started on queue: ${BOOKING_NOTIFICATION_QUEUE}`
  );
}

async function handleBookingNotificationEvent(event, eventId, correlationId) {
  const type = event?.type;
  const payload = event?.payload || {};

  if (type === "BOOKING_CONFIRMED") {
    const existingEvent = await ProcessedEvent.findOne({ eventId });

    if (existingEvent) {
      console.log(
          `Duplicate booking notification skipped eventId=${eventId} correlationId=${correlationId}`
      );
      return;
    }

    ensureRequired(payload, ["email", "bookingId", "eventTitle"]);

    await notificationService.sendNotification({
      userId: payload.userId,
      email: payload.email,
      type: "BOOKING_CONFIRMED",
      correlationId,
      payload: {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        bookingId: payload.bookingId,
        eventTitle: payload.eventTitle,
        bookingDate: payload.bookingDate,
      },
    });

    // Record only after sending succeeds. A crash before this write can still
    // result in another email on redelivery (at-least-once delivery).
    try {
      await ProcessedEvent.create({
        eventId,
        processedAt: new Date(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        console.log(
            `Processed event already recorded by another consumer eventId=${eventId} correlationId=${correlationId}`
        );
        return;
      }

      throw error;
    }

    return;
  }

  throw new PermanentMessageError(
    `Unsupported booking notification event type: ${type}`,
  );
}

function ensureRequired(payload, fields) {
  const missing = fields.filter((field) => !payload[field]);

  if (missing.length > 0) {
    throw new PermanentMessageError(
      `Missing required payload fields: ${missing.join(", ")}`,
    );
  }
}

module.exports = {
  startBookingNotificationConsumer,
};
