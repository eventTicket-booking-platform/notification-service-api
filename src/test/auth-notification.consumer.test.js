jest.mock("../services/notification.service", () => ({ sendNotification: jest.fn(), sendHostPassword: jest.fn() }));
jest.mock("../config/rabbitmq", () => ({ getRabbitChannel: jest.fn(), AUTH_NOTIFICATION_QUEUE: "auth.notification.queue" }));

const service = require("../services/notification.service");
const { getRabbitChannel } = require("../config/rabbitmq");
const { startAuthNotificationConsumer } = require("../consumers/authNotification.consumer");

describe("Auth notification consumer", () => {
  let channel, consume;
  const payload = { email: "applicant@example.test", firstName: "Alex", organizationName: "Community Events" };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    channel = { assertQueue: jest.fn(), prefetch: jest.fn(), ack: jest.fn(), nack: jest.fn(),
      consume: jest.fn(async (_queue, callback) => { consume = callback; }) };
    getRabbitChannel.mockReturnValue(channel);
    await startAuthNotificationConsumer();
  });
  afterEach(() => jest.restoreAllMocks());

  async function deliver(type, body = payload) {
    const message = { content: Buffer.from(JSON.stringify({ type, payload: body })),
      properties: { headers: { "x-correlation-id": "existing-correlation" } } };
    await consume(message);
    return message;
  }

  test("approved event generates only the needed notification request and ACKs after success", async () => {
    service.sendNotification.mockImplementation(async () => expect(channel.ack).not.toHaveBeenCalled());
    const message = await deliver("HOST_APPLICATION_APPROVED", { ...payload, password: "must-not-forward", userId: "ignored" });
    expect(service.sendNotification).toHaveBeenCalledWith({ email: payload.email, type: "HOST_APPLICATION_APPROVED",
      payload: { name: "Alex", organizationName: "Community Events" } });
    expect(service.sendHostPassword).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(channel.consume).toHaveBeenCalledWith("auth.notification.queue", expect.any(Function));
  });

  test("rejected event includes rejection reason", async () => {
    await deliver("HOST_APPLICATION_REJECTED", { ...payload, rejectionReason: "More information required" });
    expect(service.sendNotification).toHaveBeenCalledWith({ email: payload.email, type: "HOST_APPLICATION_REJECTED",
      payload: { name: "Alex", organizationName: "Community Events", rejectionReason: "More information required" } });
    expect(service.sendHostPassword).not.toHaveBeenCalled();
  });

  test.each(["HOST_APPLICATION_APPROVED", "HOST_APPLICATION_REJECTED"])("%s missing required data follows existing NACK policy", async (type) => {
    const message = await deliver(type, { email: payload.email });
    expect(service.sendNotification).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  test.each([{ ...payload, organizationName: " " }, { ...payload, firstName: {} }, { ...payload, rejectionReason: {} }])(
    "invalid host review field types are rejected without sending", async (body) => {
      const message = await deliver("HOST_APPLICATION_REJECTED", body);
      expect(service.sendNotification).not.toHaveBeenCalled();
      expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    });

  test("delivery failure preserves the existing auth NACK policy and message headers", async () => {
    service.sendNotification.mockRejectedValue(new Error("Email provider unavailable"));
    const message = await deliver("HOST_APPLICATION_APPROVED");
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(message.properties.headers).toEqual({ "x-correlation-id": "existing-correlation" });
  });

  test("unsupported event type and malformed JSON retain existing failure handling", async () => {
    const unsupported = await deliver("UNKNOWN");
    const malformed = { content: Buffer.from("{bad-json") };
    await consume(malformed);
    expect(channel.nack).toHaveBeenCalledWith(unsupported, false, false);
    expect(channel.nack).toHaveBeenCalledWith(malformed, false, false);
    expect(service.sendNotification).not.toHaveBeenCalled();
  });

  test.each(["EMAIL_VERIFICATION_OTP", "PASSWORD_RESET_OTP"])("existing %s still dispatches and ACKs", async (type) => {
    const body = { userId: "user-id", email: "user@example.test", name: "User", otp: "123456" };
    const message = await deliver(type, body);
    expect(service.sendNotification).toHaveBeenCalledWith({ userId: body.userId, email: body.email, type, payload: body });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  test("legacy HOST_PASSWORD dispatch remains separate from host application events", async () => {
    const body = { email: "host@example.test", firstName: "Host", password: "legacy-test-value" };
    const message = await deliver("HOST_PASSWORD", body);
    expect(service.sendHostPassword).toHaveBeenCalledWith(body);
    expect(service.sendNotification).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });
});
