jest.mock("../models/notification.model", () => ({ create: jest.fn(), findById: jest.fn() }));
jest.mock("../services/brevoEmail.service", () => ({ sendTransactionalEmail: jest.fn() }));
const Notification = require("../models/notification.model");
const brevo = require("../services/brevoEmail.service");
const service = require("../services/notification.service");

describe("Host review email delivery", () => {
  let record;
  beforeEach(() => {
    jest.resetAllMocks();
    record = { save: jest.fn().mockResolvedValue(undefined) };
    Notification.create.mockResolvedValue(record);
    brevo.sendTransactionalEmail.mockResolvedValue({ provider: "BREVO", providerMessageId: "provider-id" });
  });

  test("approved email uses existing account/dashboard guidance without credentials", async () => {
    await service.sendNotification({ email: "alex@example.test", type: "HOST_APPLICATION_APPROVED",
      payload: { name: "Alex", organizationName: "Events" } });
    expect(brevo.sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: { email: "alex@example.test", name: "Alex" }, subject: "Your Event Hub host application is approved",
      textContent: expect.stringContaining("Sign in again to the shared Admin/Host dashboard with your existing account"),
      htmlContent: expect.stringContaining("Events"),
    }));
    expect(Notification.create.mock.calls[0][0].type).toBe("HOST_APPLICATION_APPROVED");
    expect(brevo.sendTransactionalEmail.mock.calls[0][0].textContent).not.toMatch(/password/i);
    expect(record.status).toBe("SENT");
  });

  test("rejected email includes reason and re-application guidance, escaping user content in HTML", async () => {
    await service.sendNotification({ email: "alex@example.test", type: "HOST_APPLICATION_REJECTED",
      payload: { name: "<Alex>", organizationName: "A&B", rejectionReason: '<script>alert("x")</script>' } });
    const request = brevo.sendTransactionalEmail.mock.calls[0][0];
    expect(request.textContent).toContain('Rejection reason: <script>alert("x")</script>');
    expect(request.textContent).toContain("apply again from Become a Host");
    expect(request.htmlContent).toContain("&lt;Alex&gt;");
    expect(request.htmlContent).toContain("A&amp;B");
    expect(request.htmlContent).not.toContain("<script>");
    expect(record.status).toBe("SENT");
  });

  test("rejected email tolerates an omitted rejection reason", () => {
    const content = service.buildEmailContent("HOST_APPLICATION_REJECTED", { name: "Alex", organizationName: "Org" });
    expect(content.message).toContain("was not approved");
    expect(content.message).not.toContain("undefined");
    expect(content.html).not.toContain("Rejection reason:");
  });

  test("failed host email is recorded and remains retryable through existing failed-notification handling", async () => {
    brevo.sendTransactionalEmail.mockRejectedValue(new Error("Provider unavailable"));
    await expect(service.sendNotification({ email: "alex@example.test", type: "HOST_APPLICATION_APPROVED",
      payload: { name: "Alex", organizationName: "Org" } })).rejects.toThrow("Provider unavailable");
    expect(record.status).toBe("FAILED");
    expect(record.save).toHaveBeenCalled();
  });

  test.each(["HOST_APPLICATION_APPROVED", "HOST_APPLICATION_REJECTED"])("%s supports existing admin retry of a failed email", async (type) => {
    const payload = { name: "Alex", organizationName: "Org", rejectionReason: "More information" };
    const content = service.buildEmailContent(type, payload);
    Object.assign(record, { status: "FAILED", type, metadata: payload, email: "alex@example.test",
      subject: content.subject, message: content.message });
    Notification.findById.mockResolvedValue(record);
    await service.retryFailedNotification("507f1f77bcf86cd799439011");
    expect(record.status).toBe("SENT");
    expect(brevo.sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({
      subject: content.subject, htmlContent: content.html,
    }));
  });

  test.each(["HOST_APPLICATION_APPROVED", "HOST_APPLICATION_REJECTED", "EMAIL_VERIFICATION_OTP", "PASSWORD_RESET_OTP",
    "HOST_PASSWORD", "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "GENERAL_ALERT"])("Mongo notification schema accepts %s", (type) => {
      const Model = jest.requireActual("../models/notification.model");
      expect(new Model({ email: "alex@example.test", type, subject: "Subject", message: "Message" }).validateSync()).toBeUndefined();
    });

  test.each(["EMAIL_VERIFICATION_OTP", "PASSWORD_RESET_OTP", "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "GENERAL_ALERT"])(
    "existing %s content still builds", (type) => {
      expect(service.buildEmailContent(type, { name: "User", otp: "123456", bookingId: "B1", eventTitle: "Event",
        bookingDate: "2026-10-01T10:00:00Z", subject: "Alert", message: "Message" }).subject).toBeTruthy();
    });
});
