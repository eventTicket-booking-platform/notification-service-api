const notificationService = require("../services/notification.service");
const ProcessedEvent = require("../models/processedEvent.model");

const {
  startBookingNotificationConsumer,
} = require("../consumers/bookingNotification.consumer");

const {
  getRabbitChannel,
  BOOKING_NOTIFICATION_RETRY_QUEUE,
  BOOKING_NOTIFICATION_DLQ,
} = require("../config/rabbitmq");

jest.mock("../services/notification.service");

jest.mock("../models/processedEvent.model", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

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
    jest.resetAllMocks();

    channel = {
      prefetch: jest.fn(),

      consume: jest.fn(async (queue, handler) => {
        consumeHandler = handler;
      }),

      ack: jest.fn(),

      sendToQueue: jest.fn(),
    };

    getRabbitChannel.mockReturnValue(channel);

    ProcessedEvent.findOne.mockResolvedValue(null);
    ProcessedEvent.create.mockResolvedValue({
      eventId: "event-123",
    });
  });

  test("should ack message when notification succeeds", async () => {
    notificationService.sendNotification.mockImplementation(async () => {
      expect(ProcessedEvent.create).not.toHaveBeenCalled();
      expect(channel.ack).not.toHaveBeenCalled();
    });
    ProcessedEvent.create.mockImplementation(async () => {
      expect(notificationService.sendNotification).toHaveBeenCalledTimes(1);
      expect(channel.ack).not.toHaveBeenCalled();
      return { eventId: "event-123" };
    });

    await startBookingNotificationConsumer();

    const event = {
      type: "BOOKING_CONFIRMED",

      eventId: "event-123",

      correlationId: "test-correlation-id",

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

    expect(ProcessedEvent.findOne).toHaveBeenCalledWith({
      eventId: "event-123",
    });

    expect(notificationService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "test-correlation-id",
      }),
    );

    expect(ProcessedEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-123",
        processedAt: expect.any(Date),
      }),
    );

    expect(channel.ack).toHaveBeenCalledWith(message);

    expect(channel.ack).toHaveBeenCalledTimes(1);

    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  test("should skip duplicate event without sending notification", async () => {
    ProcessedEvent.findOne.mockResolvedValue({
      eventId: "event-123",
    });

    await startBookingNotificationConsumer();

    const event = {
      type: "BOOKING_CONFIRMED",

      eventId: "event-123",

      correlationId: "test-correlation-id",

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

    expect(ProcessedEvent.findOne).toHaveBeenCalledWith({
      eventId: "event-123",
    });

    expect(notificationService.sendNotification).not.toHaveBeenCalled();

    expect(ProcessedEvent.create).not.toHaveBeenCalled();

    expect(channel.ack).toHaveBeenCalledWith(message);

    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  test("should ack duplicate-key processed event race without retry or DLQ", async () => {
    const duplicateKeyError = new Error("Duplicate key");
    duplicateKeyError.code = 11000;

    ProcessedEvent.create.mockRejectedValue(duplicateKeyError);
    notificationService.sendNotification.mockResolvedValue();

    await startBookingNotificationConsumer();

    const event = {
      type: "BOOKING_CONFIRMED",

      eventId: "event-123",

      correlationId: "test-correlation-id",

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

    expect(ProcessedEvent.findOne).toHaveBeenCalledWith({
      eventId: "event-123",
    });

    expect(notificationService.sendNotification).toHaveBeenCalledTimes(1);

    expect(ProcessedEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-123",
        processedAt: expect.any(Date),
      }),
    );

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

      eventId: "event-123",

      correlationId: "test-correlation-id",

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

    expect(ProcessedEvent.findOne).toHaveBeenCalledWith({
      eventId: "event-123",
    });

    expect(ProcessedEvent.create).not.toHaveBeenCalled();

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      BOOKING_NOTIFICATION_RETRY_QUEUE,
      message.content,

      expect.objectContaining({
        persistent: true,

        headers: expect.objectContaining({
          "x-correlation-id": "test-correlation-id",

          "x-attempt": 2,
        }),
      }),
    );

    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  test("should process a successful retry and skip its later redelivery", async () => {
    const processedEvents = new Map();
    ProcessedEvent.findOne.mockImplementation(async ({ eventId }) =>
      processedEvents.get(eventId) || null,
    );
    ProcessedEvent.create.mockImplementation(async (record) => {
      processedEvents.set(record.eventId, record);
      return record;
    });
    notificationService.sendNotification
      .mockRejectedValueOnce(new Error("Email provider unavailable"))
      .mockResolvedValue(undefined);

    await startBookingNotificationConsumer();
    const message = {
      content: Buffer.from(JSON.stringify({
        type: "BOOKING_CONFIRMED",
        eventId: "event-retry",
        payload: {
          email: "user@test.com",
          bookingId: "BK-1",
          eventTitle: "Test Event",
        },
      })),
      properties: {
        contentType: "application/json",
        headers: {
          "x-attempt": 1,
          "x-correlation-id": "header-correlation",
          "custom-header": "preserved",
        },
      },
    };

    await consumeHandler(message);
    expect(ProcessedEvent.create).not.toHaveBeenCalled();
    expect(processedEvents.size).toBe(0);
    expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
    const [queue, content, properties] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe(BOOKING_NOTIFICATION_RETRY_QUEUE);
    expect(content).toBe(message.content);
    expect(properties).toEqual({
      persistent: true,
      contentType: "application/json",
      headers: {
        "x-attempt": 2,
        "x-correlation-id": "header-correlation",
        "custom-header": "preserved",
      },
    });

    const retryMessage = { content, properties };
    await consumeHandler(retryMessage);
    await consumeHandler(retryMessage);

    expect(notificationService.sendNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.sendNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({ correlationId: "header-correlation" }),
    );
    expect(ProcessedEvent.create).toHaveBeenCalledTimes(1);
    expect(processedEvents.has("event-retry")).toBe(true);
    expect(channel.ack).toHaveBeenCalledTimes(3);
    expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
  });

  test("should retry a processed-record write failure other than duplicate key", async () => {
    notificationService.sendNotification.mockResolvedValue();
    ProcessedEvent.create.mockRejectedValue(new Error("MongoDB unavailable"));
    await startBookingNotificationConsumer();
    const message = {
      content: Buffer.from(JSON.stringify({
        type: "BOOKING_CONFIRMED",
        eventId: "event-123",
        payload: {
          email: "user@test.com",
          bookingId: "BK-1",
          eventTitle: "Test Event",
        },
      })),
      properties: { headers: { "x-attempt": 1 } },
    };

    await consumeHandler(message);

    expect(notificationService.sendNotification).toHaveBeenCalledTimes(1);
    expect(ProcessedEvent.create).toHaveBeenCalledTimes(1);
    expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      BOOKING_NOTIFICATION_RETRY_QUEUE,
      message.content,
      expect.objectContaining({
        headers: expect.objectContaining({ "x-attempt": 2 }),
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

      eventId: "event-123",

      correlationId: "test-correlation-id",

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
          "x-correlation-id": "test-correlation-id",

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

  test("should move message with missing eventId directly to DLQ", async () => {
    await startBookingNotificationConsumer();

    const event = {
      type: "BOOKING_CONFIRMED",

      correlationId: "test-correlation-id",

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
      BOOKING_NOTIFICATION_DLQ,
      message.content,

      expect.objectContaining({
        headers: expect.objectContaining({
          "x-correlation-id": "test-correlation-id",

          "x-attempt": 1,

          "x-failure-type": "PERMANENT",

          "x-failure-reason": "Missing required eventId",
        }),
      }),
    );

    expect(channel.ack).toHaveBeenCalledWith(message);

    expect(notificationService.sendNotification).not.toHaveBeenCalled();
    expect(ProcessedEvent.findOne).not.toHaveBeenCalled();
    expect(ProcessedEvent.create).not.toHaveBeenCalled();
    expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
  });

  test.each([42, true, {}, [], " ", "\t"])(
    "should move invalid eventId %j directly to DLQ before database lookup or email",
    async (eventId) => {
      await startBookingNotificationConsumer();
      const message = {
        content: Buffer.from(JSON.stringify({
          type: "BOOKING_CONFIRMED",
          eventId,
          payload: {
            email: "user@test.com",
            bookingId: "BK-1",
            eventTitle: "Test Event",
          },
        })),
        properties: {
          contentType: "application/json",
          headers: {
            "x-attempt": 1,
            "x-correlation-id": "header-correlation",
            "custom-header": "preserved",
          },
        },
      };

      await consumeHandler(message);

      expect(ProcessedEvent.findOne).not.toHaveBeenCalled();
      expect(ProcessedEvent.create).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
      expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
      expect(channel.sendToQueue).toHaveBeenCalledWith(
        BOOKING_NOTIFICATION_DLQ,
        message.content,
        expect.objectContaining({
          persistent: true,
          contentType: "application/json",
          headers: {
            "x-attempt": 1,
            "x-correlation-id": "header-correlation",
            "custom-header": "preserved",
            "x-failure-type": "PERMANENT",
            "x-failure-reason": "eventId must be a non-empty string",
          },
        }),
      );
      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.ack).toHaveBeenCalledWith(message);
    },
  );

  test("should move unsupported event type directly to DLQ", async () => {
    await startBookingNotificationConsumer();

    const event = {
      type: "UNKNOWN_EVENT",

      eventId: "event-123",

      correlationId: "test-correlation-id",

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
          "x-correlation-id": "test-correlation-id",

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

      eventId: "event-123",

      correlationId: "test-correlation-id",

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
          "x-correlation-id": "test-correlation-id",

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
