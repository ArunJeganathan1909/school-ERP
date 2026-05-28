const express = require('express');
const router = express.Router();
const {
    getAnnouncements, getAnnouncement, createAnnouncement,
    updateAnnouncement, deleteAnnouncement
} = require('../controllers/announcementController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', protect, getAnnouncements);
router.get('/:id', protect, getAnnouncement);
router.post('/', protect, authorize('admin', 'teacher'), createAnnouncement);
router.put('/:id', protect, authorize('admin', 'teacher'), updateAnnouncement);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteAnnouncement);

module.exports = router;