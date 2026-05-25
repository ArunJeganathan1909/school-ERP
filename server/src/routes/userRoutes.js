const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getMyProfile,
    updateMyProfile
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Own profile (any logged-in user)
router.get('/profile', protect, getMyProfile);
router.put('/profile', protect, updateMyProfile);

// Admin-only: list all users, create user ( reuse register ), delete
router.get('/', protect, authorize('admin'), getAllUsers);
router.delete('/:id', protect, authorize('admin'), deleteUser);

// Admin or own: get + update single user
router.get('/:id', protect, getUserById);
router.put('/:id', protect, updateUser);

module.exports = router;