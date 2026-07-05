const express = require('express');
const router  = express.Router();
const c       = require('../controllers/subjectTeacherAssignmentController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Named routes BEFORE /:id-style routes
router.get('/my-teaching',           protect, authorize('teacher'), c.getMyTeaching);
router.get('/by-subject/:subjectId', protect, c.getBySubject);

router.get('/',     protect, c.getAll);
router.post('/',    protect, authorize('admin'), c.assignTeacher);
router.delete('/:id', protect, authorize('admin'), c.removeAssignment);

module.exports = router;