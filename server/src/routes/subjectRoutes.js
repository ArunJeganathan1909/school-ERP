const express = require('express');
const router  = express.Router();
const {
    getSubjects, getSubject, createSubject,
    updateSubject, deleteSubject, getBucketSubjects,
    getSubjectsForGrade, getBucketsForSection   // ← add this
} = require('../controllers/subjectController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// ── All named/static routes BEFORE /:id ──────────────────────────────────────
router.get('/buckets',                    protect, getBucketSubjects);
router.get('/for-grade',                  protect, getSubjectsForGrade);
router.get('/buckets-for-section/:sectionId', protect, getBucketsForSection); // ← add

router.get('/',       protect, getSubjects);
router.post('/',      protect, authorize('admin'), createSubject);
router.get('/:id',    protect, getSubject);               // ← /:id always last
router.put('/:id',    protect, authorize('admin', 'teacher'), updateSubject);
router.delete('/:id', protect, authorize('admin'), deleteSubject);

module.exports = router;