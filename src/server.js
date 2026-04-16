require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { connectRabbit } = require('./config/rabbitmq');
const { startAuthNotificationConsumer } = require('./consumers/authNotification.consumer');

const PORT = process.env.PORT || 9094;

const startServer = async () => {
  try {
    await connectDB();
    await connectRabbit();
    await startAuthNotificationConsumer();

    app.listen(PORT, () => {
      console.log(`Notification service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start notification service:', error.message);
    process.exit(1);
  }
};

startServer();
