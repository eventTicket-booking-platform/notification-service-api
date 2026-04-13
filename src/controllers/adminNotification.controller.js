const notificationService = require("../services/notification.service");
const { successResponse } = require("../utils/apiResponse");

class AdminNotificationController {
  async getLogs(req, res, next) {
    try {
      const result = await notificationService.getNotificationLogs({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        type: req.query.type,
        status: req.query.status,
        email: req.query.email,
      });

      return res
        .status(200)
        .json(
          successResponse(
            200,
            "Notification logs fetched successfully",
            result,
          ),
        );
    } catch (error) {
      return next(error);
    }
  }

  async getFailedNotifications(req, res, next) {
    try {
      const notifications = await notificationService.getFailedNotifications();

      return res
        .status(200)
        .json(
          successResponse(
            200,
            "Failed notifications fetched successfully",
            notifications,
          ),
        );
    } catch (error) {
      return next(error);
    }
  }

  async retryFailedNotification(req, res, next) {
    try {
      const notification = await notificationService.retryFailedNotification(
        req.params.id,
      );

      return res
        .status(200)
        .json(
          successResponse(
            200,
            "Notification retried successfully",
            notification,
          ),
        );
    } catch (error) {
      return next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await notificationService.getStats();

      return res
        .status(200)
        .json(
          successResponse(
            200,
            "Notification stats fetched successfully",
            stats,
          ),
        );
    } catch (error) {
      return next(error);
    }
  }

  async sendHostPassword(req, res, next) {
    try {
      const { email, password, firstName } = req.body;

      if (!email || !password || !firstName) {
        const error = new Error("Email, password, and firstName are required");
        error.statusCode = 400;
        error.exposeMessage = "Missing required fields";
        throw error;
      }

      const notification = await notificationService.sendHostPassword({
        email,
        password,
        firstName,
      });

      return res
        .status(201)
        .json(
          successResponse(
            201,
            "Host password email sent successfully",
            notification,
          ),
        );
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AdminNotificationController();
