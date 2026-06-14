const express = require('express');
const router  = express.Router();
const {
    createTimetable,
    updateTimetable,
    updateSlot,
    deleteTimetable,
    getAllTimetables,
    getTimetable,
    getMyTimetableAsStudent,
    getMyTimetableAsTeacher,
} = require('../controllers/timetableController');
const { protect }    = require('../middleware/authMiddleware');
const { authorize }  = require('../middleware/roleMiddleware');

// ── student / teacher personal views ────────────────────────────────────────
// Must come BEFORE /:id so Express doesn't treat "my" as an id param
router.get('/my/student', protect, authorize('student'), getMyTimetableAsStudent);
router.get('/my/teacher', protect, authorize('teacher'), getMyTimetableAsTeacher);

// ── admin: full CRUD on timetable structures ─────────────────────────────────
router.get('/',    protect, authorize('admin'), getAllTimetables);
router.post('/',   protect, authorize('admin'), createTimetable);

router.get('/:id',    protect, authorize('admin', 'teacher', 'student'), getTimetable);
router.put('/:id',    protect, authorize('admin'), updateTimetable);
router.delete('/:id', protect, authorize('admin'), deleteTimetable);

// ── admin: assign / clear a subject in a specific slot ──────────────────────
router.put('/:id/slots', protect, authorize('admin'), updateSlot);

module.exports = router;