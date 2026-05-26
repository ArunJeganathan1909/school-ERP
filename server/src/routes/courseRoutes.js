const express = require('express');
const router = express.Router();
const {
    getAllCourses, getCourse, getDepartments,
    updateCourse, createCourse, deleteCourse
} = require('../controllers/courseController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware')

router.get('/departments', protect, getDepartments);
router.get('/', protect, getAllCourses);
router.get('/:id', protect, getCourse);
router.post('/', protect, authorize('admin'), createCourse);
router.put('/:id', protect, authorize('admin'), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);

module.exports = router;