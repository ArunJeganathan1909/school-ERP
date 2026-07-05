const express = require('express');
const router  = express.Router();
const c       = require('../controllers/academicYearController');
const { protect }   = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/active',        protect, c.getActive);
router.get('/',              protect, authorize('admin'), c.getAll);
router.get('/:id',           protect, authorize('admin'), c.getOne);
router.post('/',             protect, authorize('admin'), c.create);
router.put('/:id',           protect, authorize('admin'), c.update);
router.put('/:id/activate',  protect, authorize('admin'), c.activate);
router.put('/:id/semester',  protect, authorize('admin'), c.setSemester);
router.delete('/:id',        protect, authorize('admin'), c.remove);

module.exports = router;