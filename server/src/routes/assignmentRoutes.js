const express = require('express');
const router  = express.Router();
const {
    getAssignments,
    getAssignment,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getMySubjects,
    uploadAttachment,
    removeAttachment,
} = require('../controllers/assignmentController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// ── specific routes FIRST (before /:id) ──────────────────────────────────────
router.get('/teacher/subjects', protect, authorize('admin', 'teacher'), getMySubjects);

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/',    protect, getAssignments);
router.get('/:id', protect, getAssignment);
router.post('/',   protect, authorize('admin', 'teacher'), createAssignment);
router.put('/:id', protect, authorize('admin', 'teacher'), updateAssignment);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteAssignment);

// ── File upload routes (only registered if cloudinary is configured) ──────────
try {
    const { uploadAssignment } = require('../config/cloudinary');
    if (uploadAssignment) {
        router.post(
            '/:id/upload',
            protect,
            authorize('admin', 'teacher'),
            uploadAssignment.single('attachment'),
            uploadAttachment
        );
        router.delete(
            '/:id/upload',
            protect,
            authorize('admin', 'teacher'),
            removeAttachment
        );
        console.log('✓ Assignment file upload routes registered');
    }
} catch (err) {
    console.warn('⚠ Cloudinary not configured — file upload routes skipped:', err.message);
}

module.exports = router;