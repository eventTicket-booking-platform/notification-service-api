const dotenv = require('dotenv');

// Load base env first (contains NODE_ENV), then load env-specific file.
dotenv.config();
const nodeEnv = process.env.NODE_ENV || 'local';
dotenv.config({ path: `.env.${nodeEnv}`, override: true });

const app = require('./app');
const connectDB = require('./config/db');
const { connectRabbit } = require('./config/rabbitmq');
const { startAuthNotificationConsumer } = require('./consumers/authNotification.consumer');
const { startBookingNotificationConsumer } = require('./consumers/bookingNotification.consumer');

const PORT = process.env.PORT || 9094;

const startServer = async () => {
  try {
    await connectDB();
    await connectRabbit();
    await startAuthNotificationConsumer();
    await startBookingNotificationConsumer();

    app.listen(PORT, () => {
      console.log(`Notification service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start notification service:', error.message);
    process.exit(1);
  }
};

startServer();
