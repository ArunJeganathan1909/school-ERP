const Lesson            = require('../models/Lesson');
const SubjectEnrollment = require('../models/SubjectEnrollment');

// ─── GET /api/lessons?subject=id&section=id ───────────────────────────────────
exports.getLessons = async (req, res) => {
    try {
        const { subject, section } = req.query;
        const filter = {};
        if (subject) filter.subject = subject;
        if (section) filter.section = section;

        // Students only see published lessons
        if (req.user.role === 'student') filter.isPublished = true;

        const lessons = await Lesson.find(filter)
            .populate('teacher', 'name')
            .populate('subject', 'name code')
            .populate('section', 'name')
            .sort({ order: 1, createdAt: 1 });

        res.status(200).json({ success: true, lessons });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/lessons/:id ─────────────────────────────────────────────────────
exports.getLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id)
            .populate('teacher', 'name profilePhoto')
            .populate('subject', 'name code')
            .populate('section', 'name');

        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        // Students: must be published AND enrolled in the subject
        if (req.user.role === 'student') {
            if (!lesson.isPublished) {
                return res.status(403).json({ success: false, message: 'Lesson not available' });
            }

            const enrolled = await SubjectEnrollment.findOne({
                student: req.user._id,
                subject: lesson.subject._id,
                status:  'active',
            });

            if (!enrolled) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not enrolled in this subject',
                });
            }
        }

        res.status(200).json({ success: true, lesson });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── POST /api/lessons — teacher or admin ────────────────────────────────────
exports.createLesson = async (req, res) => {
    try {
        const lesson = await Lesson.create({ ...req.body, teacher: req.user._id });

        await lesson.populate([
            { path: 'subject', select: 'name code' },
            { path: 'section', select: 'name' },
            { path: 'teacher', select: 'name email' },
        ]);

        res.status(201).json({ success: true, lesson });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/lessons/:id ─────────────────────────────────────────────────────
exports.updateLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        // Teachers can only edit their own lessons
        if (req.user.role === 'teacher' && String(lesson.teacher) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const updated = await Lesson.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        ).populate([
            { path: 'subject', select: 'name code' },
            { path: 'section', select: 'name' },
            { path: 'teacher', select: 'name' },
        ]);

        res.status(200).json({ success: true, lesson: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── DELETE /api/lessons/:id ──────────────────────────────────────────────────
exports.deleteLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        if (req.user.role === 'teacher' && String(lesson.teacher) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await lesson.deleteOne();
        res.status(200).json({ success: true, message: 'Lesson deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/lessons/reorder — bulk order update ────────────────────────────
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