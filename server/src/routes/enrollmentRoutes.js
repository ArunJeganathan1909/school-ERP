const express = require('express');
const router = express.Router();
const {
    enroll, dropCourse, getAllEnrollments,
    getCourseEnrollments, assignGrade, getMyEnrollments,
} = require('../controllers/enrollmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/enroll', protect, authorize('student'), enroll);
router.get('/my', protect, authorize('student'), getMyEnrollments);
router.put('/:id/drop', protect, dropCourse);
router.put('/:id/grade', protect, authorize('admin', 'teacher'), assignGrade);
router.get('/course/:courseId', protect, authorize('admin', 'teacher'), getCourseEnrollments);
router.get('/', protect, authorize('admin'), getAllEnrollments);

module.exports = router;