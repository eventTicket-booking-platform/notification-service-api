const notificationService = require("../services/notification.service");

const {
  startBookingNotificationConsumer,
} = require("../consumers/bookingNotification.consumer");

const {
  getRabbitChannel,
  BOOKING_NOTIFICATION_RETRY_QUEUE,
  BOOKING_NOTIFICATION_DLQ,
} = require("../config/rabbitmq");

jest.mock("../services/notification.service");

jest.mock("../config/rabbitmq", () => ({
  getRabbitChannel: jest.fn(),

  BOOKING_NOTIFICATION_QUEUE: "booking.notification.queue",

  BOOKING_NOTIFICATION_RETRY_QUEUE: "booking.notification.retry.queue",

  BOOKING_NOTIFICATION_DLQ: "booking.notification.dlq",
}));

describe("Booking notification consumer", () => {
  let channel;
  let consumeHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    channel = {
      prefetch: jest.fn(),

      consume: jest.fn(async (queue, handler) => {
        consumeHandler = handler;
      }),

      ack: jest.fn(),

      sendToQueue: jest.fn(),
    };

    getRabbitChannel.mockReturnValue(channel);
  });

  test("should ack message when notification succeeds", async () => {
    notificationService.sendNotification.mockResolvedValue();

    await startBookingNotificationConsumer();

    const event = {
      type: "BOOKING_CONFIRMED",

      payload: {
        userId: "user-1",
        email: "user@test.com",
        name: "Test User",
        bookingId: "BK-1",
        eventTitle: "Test Event",
        bookingDate: "2026-10-04",
      },
    };

    const message = {
      content: Buffer.from(JSON.stringify(event)),

      properties: {
        headers: {},
        contentType: "application/json",
      },
    };

    await consumeHandler(message);

    expect(notificationService.sendNotification).toHaveBeenCalledTimes(1);

    expect(channel.ack).toHaveBeenCalledWith(message);

    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  test("should move transient failure to retry queue before max attempts", async () => {
    notificationService.sendNotification.mockRejectedValue(
      new Error("Email provider unavailable"),
    );

    await startBookingNotificationConsumer();

    const event = {
      type: "BOOKING_CONFIRMED",

      payload: {
        email: "user@test.com",
        bookingId: "BK-1",
        eventTitle: "Test Event",
      },
    };

    const message = {
      content: Buffer.from(JSON.stringify(event)),

      properties: {
        headers: {
          "x-attempt": 1,
        },

        contentType: "application/json",
      },
    };

    await consumeHandler(message);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      BOOKING_NOTIFICATION_RETRY_QUEUE,
      message.content,

      expect.objectContaining({
        persistent: true,

        headers: expect.objectContaining({
          "x-attempt": 2,
        }),
      }),
    );

    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  test("should move transient failure to DLQ after max attempts", async () => {
    notificationService.sendNotification.mockRejectedValue(
      new Error("Email provider unavailable"),
    );

    await startBookingNotificationConsumer();

    const event = {
      type: "BOOKING_CONFIRMED",

      payload: {
        email: "user@test.com",
        bookingId: "BK-1",
        eventTitle: "Test Event",
      },
    };

    const message = {
      content: Buffer.from(JSON.stringify(event)),

      properties: {
        headers: {
          "x-attempt": 3,
        },

        contentType: "application/json",
      },
    };

    await consumeHandler(message);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      BOOKING_NOTIFICATION_DLQ,
      message.content,

      expect.objectContaining({
        persistent: true,

        headers: expect.objectContaining({
          "x-attempt": 3,

          "x-failure-reason": "Email provider unavailable",

          "x-failure-type": "TRANSIENT_MAX_RETRIES",
        }),
      }),
    );

    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  test("should move invalid JSON directly to DLQ", async () => {
    await startBookingNotificationConsumer();

    const message = {
      content: Buffer.from("{invalid-json"),

      properties: {
        headers: {
          "x-attempt": 1,
        },

        contentType: "application/json",
      },
    };

    await consumeHandler(message);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      BOOKING_NOTIFICATION_DLQ,
      message.content,

      expect.objectContaining({
        persistent: true,

        headers: expect.objectContaining({
          "x-attempt": 1,

          "x-failure-type": "PERMANENT",
        }),
      }),
    );

    expect(channel.ack).toHaveBeenCalledWith(message);

    expect(notificationService.sendNotification).not.toHaveBeenCalled();
  });

  test("should move unsupported event type directly to DLQ", async () => {
    await startBookingNotificationConsumer();

    const event = {
      type: "UNKNOWN_EVENT",

      payload: {},
    };

    const message = {
      content: Buffer.from(JSON.stringify(event)),

      properties: {
        headers: {
          "x-attempt": 1,
        },

        contentType: "application/json",
      },
    };

    await consumeHandler(message);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      BOOKING_NOTIFICATION_DLQ,
      message.content,

      expect.objectContaining({
        headers: expect.objectContaining({
          "x-attempt": 1,

          "x-failure-type": "PERMANENT",

          "x-failure-reason":
            "Unsupported booking notification event type: UNKNOWN_EVENT",
        }),
      }),
    );

    expect(channel.ack).toHaveBeenCalledWith(message);

    expect(notificationService.sendNotification).not.toHaveBeenCalled();
  });

  test("should move message with missing required fields directly to DLQ", async () => {
    await startBookingNotificationConsumer();

    const event = {
      type: "BOOKING_CONFIRMED",

      payload: {
        email: "user@test.com",

        // bookingId missing

        eventTitle: "Test Event",
      },
    };

    const message = {
      content: Buffer.from(JSON.stringify(event)),

      properties: {
        headers: {
          "x-attempt": 1,
        },

        contentType: "application/json",
      },
    };

    await consumeHandler(message);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      BOOKING_NOTIFICATION_DLQ,
      message.content,

      expect.objectContaining({
        headers: expect.objectContaining({
          "x-attempt": 1,

          "x-failure-type": "PERMANENT",

          "x-failure-reason": "Missing required payload fields: bookingId",
        }),
      }),
    );

    expect(channel.ack).toHaveBeenCalledWith(message);

    expect(notificationService.sendNotification).not.toHaveBeenCalled();
  });
});
