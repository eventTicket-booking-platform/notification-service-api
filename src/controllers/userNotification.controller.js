const notificationService = require('../services/notification.service');
const { successResponse } = require('../utils/apiResponse');

class UserNotificationController {
  getUserId(req) {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      const error = new Error('x-user-id header is required');
      error.statusCode = 400;
      error.exposeMessage = 'x-user-id header is required';
      throw error;
    }

    return userId;
  }

  async getMyNotifications(req, res, next) {
    try {
      const userId = this.getUserId(req);
      const notifications = await notificationService.getUserNotifications(userId);

      return res
        .status(200)
        .json(successResponse(200, 'Notifications fetched successfully', notifications));
    } catch (error) {
      return next(error);
    }
  }

  async getMyNotificationById(req, res, next) {
    try {
      const userId = this.getUserId(req);
      const notification = await notificationService.getUserNotificationById(userId, req.params.id);

      return res
        .status(200)
        .json(successResponse(200, 'Notification fetched successfully', notification));
    } catch (error) {
      return next(error);
    }
  }

  async markNotificationAsRead(req, res, next) {
    try {
      const userId = this.getUserId(req);
      const notification = await notificationService.markAsRead(userId, req.params.id);

      return res
        .status(200)
        .json(successResponse(200, 'Notification marked as read', notification));
    } catch (error) {
      return next(error);
    }
  }

  async markAllNotificationsAsRead(req, res, next) {
    try {
      const userId = this.getUserId(req);
      const result = await notificationService.markAllAsRead(userId);

      return res
        .status(200)
        .json(successResponse(200, 'All notifications marked as read', result));
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new UserNotificationController();
