const express = require('express');
const router = express.Router();
const {
    getLessons, getLesson, createLesson, updateLesson, deleteLesson, reorderLessons
} = require('../controllers/lessonController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', protect, getLessons);
router.get('/:id', protect, getLesson);
router.post('/', protect, authorize('admin', 'teacher'), createLesson);
router.put('/reorder', protect, authorize('admin', 'teacher'), reorderLessons);
router.put('/:id', protect, authorize('admin', 'teacher'), updateLesson);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteLesson);

module.exports = router;