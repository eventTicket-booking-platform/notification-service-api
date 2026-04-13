const brevo = require('@getbrevo/brevo');

const apiKey = process.env.BREVO_API_KEY;

if (!apiKey) {
  console.warn('BREVO_API_KEY is not configured. Email sending will fail until it is set.');
}

const transactionalEmailApi = new brevo.TransactionalEmailsApi();
transactionalEmailApi.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey || '');

module.exports = {
  brevo,
  transactionalEmailApi
};
