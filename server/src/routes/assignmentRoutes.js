const express = require('express');
const router  = express.Router();
const {
    getAssignments,
    getAssignment,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getMySubjects,
    getStudentAssignments,
} = require('../controllers/assignmentController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// ── specific named routes FIRST (must be before /:id) ────────────────────────
router.get('/teacher/subjects',  protect, authorize('admin', 'teacher'), getMySubjects);
router.get('/student/mine',      protect, authorize('student'),          getStudentAssignments);

// ── general routes ────────────────────────────────────────────────────────────
router.get('/',     protect, getAssignments);
router.get('/:id',  protect, getAssignment);
router.post('/',    protect, authorize('admin', 'teacher'), createAssignment);
router.put('/:id',  protect, authorize('admin', 'teacher'), updateAssignment);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteAssignment);

module.exports = router;