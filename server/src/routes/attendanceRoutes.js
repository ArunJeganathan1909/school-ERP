const express = require('express');
const router = express.Router();
const {
    markAttendance, getStudentAttendance, getMyAttendance, getCourseReport, getSessionAttendance
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/mark', protect, authorize('teacher', 'admin'), markAttendance);
router.get('/', protect, authorize('teacher', 'admin'), getSessionAttendance);
router.get('/my', protect, authorize('student'), getMyAttendance);
router.get('/report', protect, authorize('teacher', 'admin'), getCourseReport);
router.get('/student/:studentId', protect, getStudentAttendance);

module.exports = router;