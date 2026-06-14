const express = require('express');
const router  = express.Router();
const c       = require('../controllers/timetableController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Personal views — must come before /:id
router.get('/my/student',  protect, authorize('student'), c.getMyTimetableAsStudent);
router.get('/my/teacher',  protect, authorize('teacher', 'admin'), c.getMyTimetableAsTeacher);

// General
router.get('/',            protect, authorize('admin', 'teacher'), c.getAllTimetables);
router.post('/',           protect, authorize('admin'), c.createTimetable);
router.get('/:id',         protect, c.getTimetable);
router.put('/:id',         protect, authorize('admin'), c.updateTimetable);
router.put('/:id/slots',   protect, authorize('admin'), c.updateSlot);
router.delete('/:id',      protect, authorize('admin'), c.deleteTimetable);

module.exports = router;