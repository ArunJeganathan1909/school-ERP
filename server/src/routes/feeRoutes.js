const express = require('express');
const router = express.Router();
const {
    getAllFees, getMyFees, createFee, bulkCreateFees,
    updateFee, recordPayment, deleteFee, getFee
} = require('../controllers/feeController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/my', protect, authorize('student'), getMyFees);
router.get('/', protect, authorize('admin'), getAllFees);
router.get('/:id', protect, getFee);
router.post('/', protect, authorize('admin'), createFee);
router.post('/bulk', protect, authorize('admin'), bulkCreateFees);
router.put('/:id', protect, authorize('admin'), updateFee);
router.post('/:id/payment', protect, authorize('admin'), recordPayment);
router.delete('/:id', protect, authorize('admin'), deleteFee);

module.exports = router;