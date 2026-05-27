const Quiz = require('../models/Quiz');

// GET /api/quizzes?course=id&subject=id
exports.getQuizzes = async (req, res) => {
    try {
        const { course, subject } = req.query;
        const filter = {};
        if (course) filter.course = course;
        if (subject) filter.subject = subject;
        if (req.user.role === 'student') filter.isPublished = true;

        const quizzes = await Quiz.find(filter)
            .select('-questions.options.isCorrect -attempts')
            .populate('subject', 'name code')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, quizzes });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/quizzes/:id — teacher gets full quiz w/ answers; student gets without correct flags
exports.getQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('subject', 'name code')
            .populate('course', 'title');

        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

        let quizData = quiz.toObject();

        if (req.user.role === 'student') {
            // Strip correct answers from options before sending
            quizData.questions = quizData.questions.map((q) => ({
                ...q,
                correctAnswer: undefined,
                explanation: undefined,
                options: q.options.map(({ _id, text }) => ({ _id, text })),
            }));
            // Only include student's own attempts
            quizData.attempts = quiz.attempts.filter(
                (a) => String(a.student) === String(req.user._id)
            );
        }

        res.status(200).json({ success: true, quiz: quizData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/quizzes
exports.createQuiz = async (req, res) => {
    try {
        // Auto-calculate totalMarks from questions
        const totalMarks = (req.body.questions || []).reduce((sum, q) => sum + (q.marks || 1), 0);
        const quiz = await Quiz.create({ ...req.body, teacher: req.user._id, totalMarks });
        res.status(201).json({ success: true, quiz });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/quizzes/:id
exports.updateQuiz = async (req, res) => {
    try {
        if (req.body.questions) {
            req.body.totalMarks = req.body.questions.reduce((s, q) => s + (q.marks || 1), 0);
        }
        const quiz = await Quiz.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        if (!quiz) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, quiz });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/quizzes/:id
exports.deleteQuiz = async (req, res) => {
    try {
        await Quiz.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Quiz deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/quizzes/:id/attempt — student submits quiz attempt
exports.submitAttempt = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
        if (!quiz.isPublished) return res.status(403).json({ success: false, message: 'Quiz not available' });

        // Check max attempts
        const prevAttempts = quiz.attempts.filter(
            (a) => String(a.student) === String(req.user._id)
        );
        if (prevAttempts.length >= quiz.maxAttempts) {
            return res.status(400).json({ success: false, message: `Max ${quiz.maxAttempts} attempt(s) allowed` });
        }

        // Check availability window
        const now = new Date();
        if (quiz.availableFrom && now < new Date(quiz.availableFrom)) {
            return res.status(400).json({ success: false, message: 'Quiz not yet available' });
        }
        if (quiz.availableUntil && now > new Date(quiz.availableUntil)) {
            return res.status(400).json({ success: false, message: 'Quiz deadline has passed' });
        }

        const { answers, timeTaken } = req.body;
        // answers = [{ questionId, selectedOptionId?, textAnswer? }]

        let score = 0;
        const gradedAnswers = answers.map(({ questionId, selectedOptionId, textAnswer }) => {
            const question = quiz.questions.id(questionId);
            if (!question) return { question: questionId, isCorrect: false, marksAwarded: 0 };

            let isCorrect = false;
            let marksAwarded = 0;

            if (question.type === 'mcq' || question.type === 'true_false') {
                const selectedOpt = question.options.id(selectedOptionId);
                isCorrect = selectedOpt?.isCorrect || false;
            } else {
                // Short answer: simple case-insensitive match
                isCorrect = (textAnswer || '').trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
            }

            if (isCorrect) { marksAwarded = question.marks; score += question.marks; }

            return { question: questionId, selectedOption: selectedOptionId, textAnswer, isCorrect, marksAwarded };
        });

        const percentage = quiz.totalMarks > 0 ? (score / quiz.totalMarks) * 100 : 0;
        const passed = percentage >= quiz.passingPercentage;

        quiz.attempts.push({
            student: req.user._id,
            answers: gradedAnswers,
            score,
            totalMarks: quiz.totalMarks,
            percentage: Math.round(percentage * 100) / 100,
            passed,
            submittedAt: Date.now(),
            timeTaken: timeTaken || 0,
        });

        await quiz.save();

        const attempt = quiz.attempts[quiz.attempts.length - 1];

        const result = {
            score,
            totalMarks: quiz.totalMarks,
            percentage: Math.round(percentage * 100) / 100,
            passed,
        };

        if (quiz.showResults) {
            result.answers = gradedAnswers;
        }

        res.status(201).json({ success: true, result, attemptId: attempt._id });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/quizzes/:id/results — teacher sees all attempt results
exports.getQuizResults = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('attempts.student', 'name email');
        if (!quiz) return res.status(404).json({ success: false, message: 'Not found' });

        const summary = {
            totalAttempts: quiz.attempts.length,
            passed: quiz.attempts.filter((a) => a.passed).length,
            avgScore: quiz.attempts.length
                ? (quiz.attempts.reduce((s, a) => s + a.percentage, 0) / quiz.attempts.length).toFixed(1)
                : 0,
            attempts: quiz.attempts,
        };

        res.status(200).json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};