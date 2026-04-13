const express = require('express');

const controller = require('../controllers/adminNotification.controller');

const router = express.Router();

router.get('/logs', controller.getLogs);
router.get('/failed', controller.getFailedNotifications);
router.post('/:id/retry', controller.retryFailedNotification);
router.get('/stats', controller.getStats);

module.exports = router;
