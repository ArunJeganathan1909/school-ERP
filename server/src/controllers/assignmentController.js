const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');

exports.getAssignments = async (req, res) => {
    try {
        const { course, subject } = req.query;
        const filter = {};
        if (course) filter.course = course;
        if (subject) filter.subject = subject;
        if (req.user.role === 'student') filter.isPublished = true;

        const assignments = await Assignment.find(filter)
            .populate('subject', 'name code')
            .populate('teacher', 'name')
            .sort({ dueDate: 1 });

        res.status(200).json({ success: true, assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('subject', 'name code')
            .populate('teacher', 'name profilePhoto')
            .populate('course', 'title');

        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

        // Include student's own submission if any
        let submission = null;
        if (req.user.role === 'student') {
            submission = await Submission.findOne({ assignment: req.params.id, student: req.user._id });
        }

        res.status(200).json({ success: true, assignment, submission });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.create({ ...req.body, teacher: req.user._id });
        res.status(201).json({ success: true, assignment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findByIdAndUpdate(
            req.params.id, { $set: req.body }, { new: true, runValidators: true }
        );
        if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, assignment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteAssignment = async (req, res) => {
    try {
        await Assignment.findByIdAndDelete(req.params.id);
        await Submission.deleteMany({ assignment: req.params.id });
        res.status(200).json({ success: true, message: 'Assignment and all submissions deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};