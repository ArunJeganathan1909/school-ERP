const express = require('express');
const router = express.Router();
const {
    getAdminDashboard, getCourseAnalytics,
    getStudentReport, getTeacherReport,
    exportStudentPDF, exportFeesPDF, exportAttendancePDF
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/admin/dashboard', protect, authorize('admin'), getAdminDashboard);
router.get('/admin/courses', protect, authorize('admin'), getCourseAnalytics);
router.get('/student/:studentId', protect, getStudentReport);
router.get('/teacher', protect, authorize('teacher'), getTeacherReport);

// PDF exports
router.get('/export/student/:studentId', protect, authorize('admin'), exportStudentPDF);
router.get('/export/fees', protect, authorize('admin'), exportFeesPDF);
router.get('/export/attendance', protect, authorize('admin'), exportAttendancePDF);

module.exports = router;