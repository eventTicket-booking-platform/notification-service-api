const express = require('express');

const controller = require('../controllers/userNotification.controller');

const router = express.Router();

router.get('/', controller.getMyNotifications.bind(controller));
router.get('/:id', controller.getMyNotificationById.bind(controller));
router.patch('/read-all', controller.markAllNotificationsAsRead.bind(controller));
router.patch('/:id/read', controller.markNotificationAsRead.bind(controller));

module.exports = router;
