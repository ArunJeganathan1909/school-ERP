const express = require('express');
const router  = express.Router();
const c       = require('../controllers/timetableController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// ── Personal views — must be before /:id ─────────────────────────────────────
router.get('/my/student',  protect, authorize('student'), c.getMyTimetableAsStudent);
router.get('/my/teacher',  protect, authorize('teacher','admin'), c.getMyTimetableAsTeacher);

// ── PDF downloads — must also be before /:id ─────────────────────────────────
router.get('/my/student/pdf', protect, authorize('student'), c.downloadMyTimetablePdfAsStudent);
router.get('/my/teacher/pdf', protect, authorize('teacher','admin'), c.downloadMyTimetablePdfAsTeacher);

// ── Free-subject query for slot assignment ────────────────────────────────────
router.get('/free-subjects', protect, authorize('admin'), c.getFreeSubjectsForSlot);

// ── Admin: view/download a specific teacher's merged schedule ────────────────
// Must be before /:id so "teacher" isn't swallowed as a timetable id.
router.get('/teacher/:teacherId',     protect, authorize('admin'), c.getTimetableByTeacher);
router.get('/teacher/:teacherId/pdf', protect, authorize('admin'), c.downloadTimetablePdfByTeacher);

// ── Admin: bulk PDF downloads — every section, or every teacher ──────────────
router.get('/download-all/sections', protect, authorize('admin'), c.downloadAllSectionTimetablesPdf);
router.get('/download-all/teachers', protect, authorize('admin'), c.downloadAllTeacherTimetablesPdf);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/',            protect, authorize('admin','teacher'), c.getAllTimetables);
router.post('/',           protect, authorize('admin'), c.createTimetable);
router.get('/:id',         protect, c.getTimetable);
router.get('/:id/pdf',     protect, authorize('admin'), c.downloadTimetablePdf);
router.put('/:id',         protect, authorize('admin'), c.updateTimetable);
router.put('/:id/slots',   protect, authorize('admin'), c.updateSlot);
router.delete('/:id',      protect, authorize('admin'), c.deleteTimetable);

module.exports = router;