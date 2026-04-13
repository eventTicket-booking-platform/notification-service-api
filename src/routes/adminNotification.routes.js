const express = require("express");

const controller = require("../controllers/adminNotification.controller");

const router = express.Router();

// Get admin statistics
router.get("/stats", controller.getStats);

// Get notification logs
router.get("/logs", controller.getLogs);

// Get failed notifications
router.get("/failed", controller.getFailedNotifications);

// Retry a failed notification
router.post("/failed/:id/retry", controller.retryFailedNotification);

// Send host password email
router.post("/send-host-password", controller.sendHostPassword);

module.exports = router;
