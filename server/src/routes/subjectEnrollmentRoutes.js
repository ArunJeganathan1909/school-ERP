const express = require('express');
const router  = express.Router();
const c       = require('../controllers/subjectEnrollmentController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// ── Student personal route ────────────────────────────────────────────────────
router.get('/my', protect, authorize('student'), c.getMySubjects);

// ── Admin: all enrollments with filters ──────────────────────────────────────
router.get('/', protect, authorize('admin'), c.getAll);

// ── Admin: assign / change bucket subject for a student ──────────────────────
router.post('/bucket',        protect, authorize('admin'), c.assignBucketSubject);
router.put('/bucket/change',  protect, authorize('admin'), c.changeBucketSubject);

// ── Admin: pending bucket checklist for a section ────────────────────────────
router.get('/section/:sectionId/pending-buckets', protect, authorize('admin'), c.getPendingBucketSelections);

// ── Teacher/Admin: students enrolled in a specific subject ───────────────────
router.get('/subject/:subjectId', protect, authorize('admin', 'teacher'), c.getSubjectStudents);

// ── Teacher/Admin: view any student's subject list ───────────────────────────
router.get('/student/:studentId', protect, authorize('admin', 'teacher'), c.getStudentSubjects);

// ── Teacher/Admin: enter marks ───────────────────────────────────────────────
router.put('/:id/marks', protect, authorize('admin', 'teacher'), c.enterMarks);

module.exports = router;