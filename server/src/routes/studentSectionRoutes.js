const express = require('express');
const router  = express.Router();
const c       = require('../controllers/studentSectionController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Student personal routes — must come before /:id
router.get('/my',                protect, authorize('student'), c.getMyHistory);
router.get('/my/current',        protect, authorize('student'), c.getMyCurrent);

// Admin routes
router.get('/',                  protect, authorize('admin'), c.getAll);
router.post('/assign',           protect, authorize('admin'), c.assignStudent);
router.post('/promote',          protect, authorize('admin'), c.promoteStudents);
router.put('/transfer',          protect, authorize('admin'), c.transferStudent);
router.put('/:id/withdraw',      protect, authorize('admin'), c.withdrawStudent);
router.put('/:id/roll-number',   protect, authorize('admin'), c.updateRollNumber);

module.exports = router;