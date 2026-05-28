const express = require('express');
const router = express.Router();
const {
    getMyNotifications, markAllRead, clearAll, markRead, deleteNotification
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getMyNotifications);
router.put('/read-all', protect, markAllRead);
router.delete('/', protect, clearAll);
router.put('/:id/read', protect, markRead);
router.delete('/:id', protect, deleteNotification);

module.exports = router;