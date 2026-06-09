const express = require('express');
const router = express.Router();
const {
    markAttendance,
    getStudentAttendance,
    getMyAttendance,
    getCourseReport,
    getSessionAttendance,
    getEnrolledStudentsBySubject,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// GET /api/attendances/enrolled-students?subjectId=&date=
// Teacher fetches the student list for a subject + any existing records for that date
router.get('/enrolled-students', protect, authorize('teacher', 'admin'), getEnrolledStudentsBySubject);

router.post('/mark',                 protect, authorize('teacher', 'admin'), markAttendance);
router.get('/',                      protect, authorize('teacher', 'admin'), getSessionAttendance);
router.get('/my',                    protect, authorize('student'),          getMyAttendance);
router.get('/report',                protect, authorize('teacher', 'admin'), getCourseReport);
router.get('/student/:studentId',    protect,                                getStudentAttendance);

module.exports = router;