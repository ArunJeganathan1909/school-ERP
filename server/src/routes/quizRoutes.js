const express = require('express');
const router = express.Router();
const c = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', protect, c.getQuizzes);
router.get('/:id', protect, c.getQuiz);
router.post('/', protect, authorize('admin', 'teacher'), c.createQuiz);
router.put('/:id', protect, authorize('admin', 'teacher'), c.updateQuiz);
router.delete('/:id', protect, authorize('admin', 'teacher'), c.deleteQuiz);
router.post('/:id/attempt', protect, authorize('student'), c.submitAttempt);
router.get('/:id/results', protect, authorize('admin', 'teacher'), c.getQuizResults);

module.exports = router;