const express = require("express");

const controller = require("../controllers/userNotification.controller");

const router = express.Router();

// Get all user notifications
router.get("/", controller.getMyNotifications.bind(controller));

// Get specific notification by ID
router.get("/:id", controller.getMyNotificationById.bind(controller));

// Mark all notifications as read
router.patch(
  "/read-all",
  controller.markAllNotificationsAsRead.bind(controller),
);

// Mark specific notification as read
router.patch("/:id/read", controller.markNotificationAsRead.bind(controller));

module.exports = router;
