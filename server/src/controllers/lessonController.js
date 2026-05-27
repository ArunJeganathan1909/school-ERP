const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');

// GET /api/lessons?subject=id&course=id
exports.getLessons = async (req, res) => {
    try {
        const { subject, course } = req.query;
        const filter = {};
        if (subject) filter.subject = subject;
        if (course) filter.course = course;

        // Students only see published lessons
        if (req.user.role === 'student') filter.isPublished = true;

        const lessons = await Lesson.find(filter)
            .populate('teacher', 'name')
            .populate('subject', 'name code')
            .sort({ order: 1, createdAt: 1 });

        res.status(200).json({ success: true, lessons });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/lessons/:id
exports.getLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id)
            .populate('teacher', 'name profilePhoto')
            .populate('subject', 'name code')
            .populate('course', 'title code');

        if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

        // Students: check enrollment + published
        if (req.user.role === 'student') {
            if (!lesson.isPublished) return res.status(403).json({ success: false, message: 'Lesson not available' });
            const enrolled = await Enrollment.findOne({ student: req.user._id, course: lesson.course._id, status: 'active' });
            if (!enrolled) return res.status(403).json({ success: false, message: 'Enroll in this course to access lessons' });
        }

        res.status(200).json({ success: true, lesson });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/lessons
exports.createLesson = async (req, res) => {
    try {
        const lesson = await Lesson.create({ ...req.body, teacher: req.user._id });
        res.status(201).json({ success: true, lesson });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/lessons/:id
exports.updateLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

        if (req.user.role === 'teacher' && String(lesson.teacher) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const updated = await Lesson.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.status(200).json({ success: true, lesson: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/lessons/:id
exports.deleteLesson = async (req, res) => {
    try {
        await Lesson.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Lesson deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/lessons/reorder  — bulk order update
exports.reorderLessons = async (req, res) => {
    try {
        // req.body.lessons = [{ _id, order }]
        const ops = req.body.lessons.map(({ _id, order }) => ({
            updateOne: { filter: { _id }, update: { $set: { order } } },
        }));
        await Lesson.bulkWrite(ops);
        res.status(200).json({ success: true, message: 'Lessons reordered' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};