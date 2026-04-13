const { brevo, transactionalEmailApi } = require('../config/brevo');

class BrevoEmailService {
  async sendTransactionalEmail({ to, subject, textContent, htmlContent }) {
    if (!process.env.BREVO_API_KEY) {
      const error = new Error('Brevo API key is missing');
      error.statusCode = 500;
      error.exposeMessage = 'Email delivery configuration is unavailable';
      error.details = { provider: 'BREVO', reason: 'BREVO_API_KEY_NOT_CONFIGURED' };
      throw error;
    }

    if (!process.env.BREVO_SENDER_EMAIL || !process.env.BREVO_SENDER_NAME) {
      const error = new Error('Brevo sender configuration is missing');
      error.statusCode = 500;
      error.exposeMessage = 'Email delivery configuration is unavailable';
      error.details = {
        provider: 'BREVO',
        reason: 'BREVO_SENDER_NOT_CONFIGURED'
      };
      throw error;
    }

    const emailRequest = new brevo.SendSmtpEmail();
    emailRequest.sender = {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME
    };
    emailRequest.to = [{ email: to.email, name: to.name || undefined }];
    emailRequest.subject = subject;
    emailRequest.textContent = textContent;
    emailRequest.htmlContent = htmlContent;

    try {
      const response = await transactionalEmailApi.sendTransacEmail(emailRequest);

      return {
        provider: 'BREVO',
        providerMessageId:
          response?.body?.messageId || response?.messageId || response?.body?.messageIds?.[0] || null,
        raw: response?.body || response
      };
    } catch (error) {
      const providerError = new Error('Failed to send email with Brevo');
      providerError.statusCode = 502;
      providerError.exposeMessage = 'Unable to send notification email';
      providerError.details = {
        provider: 'BREVO',
        message: error?.message || 'Unknown Brevo error',
        response: error?.response?.body || null
      };
      throw providerError;
    }
  }
}

module.exports = new BrevoEmailService();
