const { brevo, transactionalEmailApi } = require("../config/brevo");

class BrevoEmailService {
  async sendTransactionalEmail({ to, subject, textContent, htmlContent }) {
    if (!process.env.BREVO_API_KEY) {
      const error = new Error("Brevo API key is missing");
      error.statusCode = 500;
      error.exposeMessage = "Email delivery configuration is unavailable";
      error.details = {
        provider: "BREVO",
        reason: "BREVO_API_KEY_NOT_CONFIGURED",
      };
      throw error;
    }

    if (!process.env.BREVO_SENDER_EMAIL || !process.env.BREVO_SENDER_NAME) {
      const error = new Error("Brevo sender configuration is missing");
      error.statusCode = 500;
      error.exposeMessage = "Email delivery configuration is unavailable";
      error.details = {
        provider: "BREVO",
        reason: "BREVO_SENDER_NOT_CONFIGURED",
      };
      throw error;
    }

    const emailRequest = new brevo.SendSmtpEmail();
    emailRequest.sender = {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME,
    };
    emailRequest.to = [{ email: to.email, name: to.name || undefined }];
    emailRequest.subject = subject;
    emailRequest.textContent = textContent;
    emailRequest.htmlContent = htmlContent;

    try {
      const response =
        await transactionalEmailApi.sendTransacEmail(emailRequest);

      return {
        provider: "BREVO",
        providerMessageId:
          response?.body?.messageId ||
          response?.messageId ||
          response?.body?.messageIds?.[0] ||
          null,
        raw: response?.body || response,
      };
    } catch (error) {
      const providerError = new Error("Failed to send email with Brevo");
      providerError.statusCode = 502;
      providerError.exposeMessage = "Unable to send notification email";
      providerError.details = {
        provider: "BREVO",
        message: error?.message || "Unknown Brevo error",
        response: error?.response?.body || null,
      };
      throw providerError;
    }
  }

  async sendHostPassword(email, password, firstName) {
    const fixedMessage = "Access your system by using the above password";
    if (!process.env.BREVO_API_KEY) {
      const error = new Error("Brevo API key is missing");
      error.statusCode = 500;
      error.exposeMessage = "Email delivery configuration is unavailable";
      error.details = {
        provider: "BREVO",
        reason: "BREVO_API_KEY_NOT_CONFIGURED",
      };
      throw error;
    }

    if (!process.env.BREVO_SENDER_EMAIL || !process.env.BREVO_SENDER_NAME) {
      const error = new Error("Brevo sender configuration is missing");
      error.statusCode = 500;
      error.exposeMessage = "Email delivery configuration is unavailable";
      error.details = {
        provider: "BREVO",
        reason: "BREVO_SENDER_NOT_CONFIGURED",
      };
      throw error;
    }

    const emailRequest = new brevo.SendSmtpEmail();
    emailRequest.sender = {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME,
    };
    emailRequest.to = [{ email: email, name: firstName }];
    emailRequest.subject = "Host System Access - Credentials";
    emailRequest.textContent = `Hello ${firstName}, ${fixedMessage}\nEmail: ${email}\nPassword: ${password}`;
    emailRequest.htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h2>Host System Access</h2>
        <p>Hello ${firstName},</p>
        <p>${fixedMessage}</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> <code style="background-color: #e5e7eb; padding: 4px 8px;">${password}</code></p>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Please change your password after your first login for security.</p>
      </div>
    `;

    try {
      const response =
        await transactionalEmailApi.sendTransacEmail(emailRequest);

      return {
        provider: "BREVO",
        providerMessageId:
          response?.body?.messageId ||
          response?.messageId ||
          response?.body?.messageIds?.[0] ||
          null,
        raw: response?.body || response,
      };
    } catch (error) {
      const providerError = new Error(
        "Failed to send host password email with Brevo",
      );
      providerError.statusCode = 502;
      providerError.exposeMessage = "Unable to send host password email";
      providerError.details = {
        provider: "BREVO",
        message: error?.message || "Unknown Brevo error",
        response: error?.response?.body || null,
      };
      throw providerError;
    }
  }
}

module.exports = new BrevoEmailService();
