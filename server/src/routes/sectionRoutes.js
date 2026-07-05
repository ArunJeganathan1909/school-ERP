const express = require('express');
const router  = express.Router();
const c       = require('../controllers/sectionController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/',                      protect, c.getAll);
router.get('/:id',                   protect, c.getOne);
router.get('/:id/students',          protect, authorize('admin', 'teacher'), c.getSectionStudents);
router.post('/',                     protect, authorize('admin'), c.create);
router.put('/:id',                   protect, authorize('admin'), c.update);
router.delete('/:id',                protect, authorize('admin'), c.remove);

module.exports = router;