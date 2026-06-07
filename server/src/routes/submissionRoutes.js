const express = require('express');
const router = express.Router();
const {
    getAssignmentSubmissions,
    getMySubmissions,
    gradeSubmission,
    submitAssignment,
    deleteSubmission,
} = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/',    protect, authorize('student'),          submitAssignment);
router.get('/my',   protect, authorize('student'),          getMySubmissions);
router.get('/assignment/:assignmentId', protect, authorize('admin', 'teacher'), getAssignmentSubmissions);
router.put('/:id/grade',  protect, authorize('admin', 'teacher'), gradeSubmission);
router.delete('/:id',     protect, authorize('admin', 'teacher'), deleteSubmission);

module.exports = router;