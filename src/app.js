const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const internalNotificationRoutes = require("./routes/internalNotification.routes");
const userNotificationRoutes = require("./routes/userNotification.routes");
const adminNotificationRoutes = require("./routes/adminNotification.routes");
const notFoundMiddleware = require("./middlewares/notFound.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/notification-service/health", (req, res) => {
  res.status(200).json({
    code: 200,
    message: "Notification service is running",
    data: {
      status: "UP",
      timestamp: new Date().toISOString(),
    },
  });
});

// Test endpoint to verify gateway connectivity and test email sending
app.post("/notification-service/api/v1/test", async (req, res, next) => {
  try {
    const { email, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({
        code: 400,
        message: "Email and message are required",
        data: null,
      });
    }

    const notificationService = require("./services/notification.service");
    const notification = await notificationService.sendNotification({
      email,
      type: "GENERAL_ALERT",
      payload: {
        name: "Test User",
        subject: "Test Email",
        message: message,
      },
    });

    return res.status(200).json({
      code: 200,
      message: "Test email sent successfully",
      data: {
        service: "notification-service-api",
        version: "1.0.0",
        status: "UP",
        gateway: "accessible",
        notificationId: notification._id,
        emailStatus: notification.status,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.use(
  "/notification-service/api/v1/internal/notifications",
  internalNotificationRoutes,
);
app.use(
  "/notification-service/api/v1/user/notifications",
  userNotificationRoutes,
);
app.use(
  "/notification-service/api/v1/admin/notifications",
  adminNotificationRoutes,
);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
