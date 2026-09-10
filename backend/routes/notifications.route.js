const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');

router.get('/', notificationsController.getNotifications.bind(notificationsController));
router.put('/read-all', notificationsController.markAllAsRead.bind(notificationsController));
router.put('/:id/read', notificationsController.markAsRead.bind(notificationsController));
router.patch('/:id/read', notificationsController.markAsRead.bind(notificationsController));
router.post('/:id/read', notificationsController.markAsRead.bind(notificationsController));
router.delete('/clear-read', notificationsController.clearReadNotifications.bind(notificationsController));
router.delete('/:id', notificationsController.deleteNotification.bind(notificationsController));

module.exports = router;
