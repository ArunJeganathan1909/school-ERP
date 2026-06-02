const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Subject    = require('../models/Subject');

// GET /api/assignments
exports.getAssignments = async (req, res) => {
    try {
        const { course, subject } = req.query;
        const filter = {};
        if (course)  filter.course  = course;
        if (subject) filter.subject = subject;
        if (req.user.role === 'student') filter.isPublished = true;

        const assignments = await Assignment.find(filter)
            .populate('subject', 'name code')
            .populate('course',  'title code')
            .populate('teacher', 'name')
            .sort({ dueDate: 1 });

        res.status(200).json({ success: true, assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/assignments/:id
exports.getAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('subject', 'name code')
            .populate('teacher', 'name profilePhoto')
            .populate('course',  'title');

        if (!assignment)
            return res.status(404).json({ success: false, message: 'Assignment not found' });

        let submission = null;
        if (req.user.role === 'student') {
            submission = await Submission.findOne({
                assignment: req.params.id,
                student: req.user._id,
            });
        }

        res.status(200).json({ success: true, assignment, submission });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/assignments/teacher/subjects?course=id
// Returns subjects assigned to the logged-in teacher, optionally filtered by course
exports.getMySubjects = async (req, res) => {
    try {
        const { course } = req.query;
        const filter = { teacher: req.user._id };
        if (course && course.trim()) filter.course = course.trim();

        const subjects = await Subject.find(filter)
            .populate('course', 'title code')
            .sort({ name: 1 });

        res.status(200).json({ success: true, subjects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/assignments
exports.createAssignment = async (req, res) => {
    try {
        const { title, course, dueDate, subject } = req.body;

        // Manual validation
        if (!title)   return res.status(400).json({ success: false, message: 'Title is required' });
        if (!course)  return res.status(400).json({ success: false, message: 'Course is required' });
        if (!dueDate) return res.status(400).json({ success: false, message: 'Due date is required' });

        // Sanitize subject — convert empty string to null
        const sanitized = {
            ...req.body,
            subject: subject && subject.trim() !== '' ? subject : null,
            teacher: req.user._id,
        };

        const assignment = await Assignment.create(sanitized);

        const populated = await Assignment.findById(assignment._id)
            .populate('subject', 'name code')
            .populate('course',  'title code')
            .populate('teacher', 'name');

        res.status(201).json({ success: true, assignment: populated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/assignments/:id
exports.updateAssignment = async (req, res) => {
    try {
        // Sanitize subject
        if (req.body.subject !== undefined) {
            req.body.subject =
                req.body.subject && String(req.body.subject).trim() !== ''
                    ? req.body.subject
                    : null;
        }

        const assignment = await Assignment.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: false }   // runValidators: false since subject is now nullable
        )
            .populate('subject', 'name code')
            .populate('course',  'title code');

        if (!assignment)
            return res.status(404).json({ success: false, message: 'Not found' });

        res.status(200).json({ success: true, assignment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/assignments/:id
exports.deleteAssignment = async (req, res) => {
    try {
        await Assignment.findByIdAndDelete(req.params.id);
        await Submission.deleteMany({ assignment: req.params.id });
        res.status(200).json({ success: true, message: 'Assignment and all submissions deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};