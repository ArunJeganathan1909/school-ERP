const express = require('express');
const router = express.Router();
const {
    getSubjects, getSubject, createSubject,
    updateSubject, deleteSubject,
} = require('../controllers/subjectController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', protect, getSubjects);
router.get('/:id', protect, getSubject);
router.post('/', protect, authorize('admin'), createSubject);
router.put('/:id', protect, authorize('admin', 'teacher'), updateSubject);
router.delete('/:id', protect, authorize('admin'), deleteSubject);

module.exports = router;