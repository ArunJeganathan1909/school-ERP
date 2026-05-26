const Subject = require('../models/Subject');

// GET /api/subjects?course=id
exports.getSubjects = async (req, res) => {
    try {
        const { course, semester, teacher } = req.query;
        const filter = {};
        if (course) filter.course = course;
        if (semester) filter.semester = Number(semester);
        if (teacher) filter.teacher = teacher;

        const subjects = await Subject.find(filter)
            .populate('course', 'title code')
            .populate('teacher', 'name email')
            .sort({ semester: 1, name: 1 });

        res.status(200).json({
            success: true,
            subjects
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GET /api/subjects/:id
exports.getSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id)
            .populate('course', 'title code department')
            .populate('teacher', 'name email profilePhoto');

        if (!subject) return res.status(404).json({
            success: false,
            message: 'Subject not found'
        });
        res.status(200).json({
            success: true,
            subject
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// POST /api/subjects — admin only
exports.createSubject = async (req, res) => {
    try {
        const subject = await Subject.create(req.body);
        const populated = await subject
            .populate('course', 'title code')
            .then(s => s.populate('teacher', 'name email'));
        res.status(201).json({
            success: true,
            subject: populated
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Subject code already exists in this course'
            });
        }
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// PUT /api/subjects/:id — admin or assigned teacher
exports.updateSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({
            success: false,
            message: 'Subject not found'
        });

        // Teachers can only update their own subjects
        if (req.user.role === 'teacher' && String(subject.teacher) !== String(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        const updated = await Subject.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate('course', 'title code').populate('teacher', 'name email');

        res.status(200).json({
            success: true,
            subject: updated
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// DELETE /api/subjects/:id — admin only
exports.deleteSubject = async (req, res) => {
    try {
        const subject = await Subject.findByIdAndDelete(req.params.id);
        if (!subject) return res.status(404).json({
            success: false,
            message: 'Subject not found'
        });
        res.status(200).json({
            success: true,
            message: 'Subject deleted'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};