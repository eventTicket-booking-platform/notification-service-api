const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const internalNotificationRoutes = require('./routes/internalNotification.routes');
const userNotificationRoutes = require('./routes/userNotification.routes');
const adminNotificationRoutes = require('./routes/adminNotification.routes');
const notFoundMiddleware = require('./middlewares/notFound.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/notification-service/health', (req, res) => {
  res.status(200).json({
    code: 200,
    message: 'Notification service is running',
    data: {
      status: 'UP',
      timestamp: new Date().toISOString()
    }
  });
});

app.use(
  '/notification-service/api/v1/internal/notifications',
  internalNotificationRoutes
);
app.use('/notification-service/api/v1/user/notifications', userNotificationRoutes);
app.use('/notification-service/api/v1/admin/notifications', adminNotificationRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
