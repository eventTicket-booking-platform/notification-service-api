# Notification Service API

Notification delivery service for Event Hub. This service stores notification records in MongoDB, consumes RabbitMQ messages, and sends email through Brevo.

## Stack

- Node.js
- Express
- MongoDB with Mongoose
- RabbitMQ via `amqplib`
- Brevo email API

## Functional Requirements

- Consume auth notification messages from RabbitMQ
- Consume booking notification messages from RabbitMQ
- Send email verification OTP emails
- Send password reset OTP emails
- Send booking confirmation emails
- Send booking cancellation emails
- Store notification delivery logs
- Return notification stats and logs
- Return failed notifications
- Retry failed notifications
- Send host-password emails from the admin flow
- Expose a test email endpoint

## Non-Functional Requirements

- Asynchronous queue-driven delivery
- Persistent MongoDB audit trail for sent and failed notifications
- Graceful startup only after DB and RabbitMQ connectivity are ready
- Environment-based configuration with local and prod files
- Health endpoint for runtime checks

## APIs

Health and test:

- `GET /notification-service/health`
- `POST /notification-service/api/v1/test`

Internal notification endpoints:

- `POST /notification-service/api/v1/internal/notifications/email-verification-otp`
- `POST /notification-service/api/v1/internal/notifications/password-reset-otp`
- `POST /notification-service/api/v1/internal/notifications/booking-confirmed`
- `POST /notification-service/api/v1/internal/notifications/booking-cancelled`

Admin endpoints:

- `GET /notification-service/api/v1/admin/notifications/stats`
- `GET /notification-service/api/v1/admin/notifications/logs`
- `GET /notification-service/api/v1/admin/notifications/failed`
- `POST /notification-service/api/v1/admin/notifications/failed/:id/retry`
- `POST /notification-service/api/v1/admin/notifications/send-host-password`

## Role-Based Access

Current code does not implement JWT verification or role middleware in this service.

What the routes imply:

- `/internal/...` is intended for service-to-service use
- `/admin/...` is intended for admin tooling

Actual enforcement today:

- none inside this service

If this is exposed outside the trusted network, access control must be added here or enforced strictly at the gateway and ingress layer.

## Runtime Dependencies

- MongoDB
- RabbitMQ
- Brevo API credentials

## Local Setup

1. Use `.env.local` for local values.
2. Fill or verify:
   - `PORT`
   - `MONGO_URI`
   - `RABBITMQ_HOST`
   - `RABBITMQ_PORT`
   - `RABBITMQ_USERNAME`
   - `RABBITMQ_PASSWORD`
   - `BREVO_API_KEY`
   - `BREVO_SENDER_EMAIL`
   - `BREVO_SENDER_NAME`
3. Install dependencies:

```powershell
npm install
```

4. Start MongoDB and RabbitMQ.
5. Run:

```powershell
npm run dev
```

Default port: `9094`

## Production Run

```powershell
npm start
```

## Notes

- `src/server.js` loads `.env`, then `.env.<NODE_ENV>`.
- The service starts consumers automatically after DB and RabbitMQ connections succeed.
