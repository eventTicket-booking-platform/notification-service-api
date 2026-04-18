const amqp = require("amqplib");

const AUTH_NOTIFICATION_QUEUE = process.env.AUTH_NOTIFICATION_QUEUE || "auth.notification.queue";
const BOOKING_NOTIFICATION_QUEUE = process.env.BOOKING_NOTIFICATION_QUEUE || "booking.notification.queue";

let connection;
let channel;

function resolveRabbitUrl() {
  if (process.env.RABBITMQ_URL) {
    return process.env.RABBITMQ_URL;
  }

  const host = process.env.RABBITMQ_HOST || "localhost";
  const port = process.env.RABBITMQ_PORT || "5672";
  const username = process.env.RABBITMQ_USERNAME || "guest";
  const password = process.env.RABBITMQ_PASSWORD || "guest";

  return `amqp://${username}:${password}@${host}:${port}`;
}

async function connectRabbit() {
  if (channel) {
    return { connection, channel };
  }

  const rabbitUrl = resolveRabbitUrl();
  connection = await amqp.connect(rabbitUrl);
  channel = await connection.createChannel();
  await channel.assertQueue(AUTH_NOTIFICATION_QUEUE, { durable: true });
  await channel.assertQueue(BOOKING_NOTIFICATION_QUEUE, { durable: true });

  connection.on("error", (error) => {
    console.error("RabbitMQ connection error:", error.message);
  });

  connection.on("close", () => {
    console.error("RabbitMQ connection closed");
    channel = null;
    connection = null;
  });

  return { connection, channel };
}

function getRabbitChannel() {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }

  return channel;
}

module.exports = {
  connectRabbit,
  getRabbitChannel,
  AUTH_NOTIFICATION_QUEUE,
  BOOKING_NOTIFICATION_QUEUE,
};
