const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Subject    = require('../models/Subject');
const mongoose   = require('mongoose');

// GET /api/assignments
exports.getAssignments = async (req, res) => {
    try {
        const { course, courses, subject } = req.query;

        const filter = {};

        if (courses && courses.trim()) {
            const ids = courses
                .split(',')
                .map(id => id.trim())
                .filter(id => mongoose.isValidObjectId(id))
                .map(id => new mongoose.Types.ObjectId(id));

            if (ids.length > 0) filter.course = { $in: ids };
        } else if (course && mongoose.isValidObjectId(course)) {
            filter.course = new mongoose.Types.ObjectId(course);
        }

        if (subject && mongoose.isValidObjectId(subject)) {
            filter.subject = new mongoose.Types.ObjectId(subject);
        }

        if (req.user.role === 'student') filter.isPublished = true;

        const assignments = await Assignment.find(filter)
            .populate('subject', 'name code')
            .populate('course',  'title code')
            .populate('teacher', 'name')
            .sort({ dueDate: 1 });

        res.status(200).json({ success: true, assignments });
    } catch (err) {
        console.error('getAssignments error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/assignments/teacher/subjects
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

// GET /api/assignments/:id
exports.getAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('subject', 'name code')
            .populate('teacher', 'name profilePhoto')
            .populate('course',  'title code');

        if (!assignment)
            return res.status(404).json({ success: false, message: 'Assignment not found' });

        let submission = null;
        if (req.user.role === 'student') {
            submission = await Submission.findOne({
                assignment: req.params.id,
                student:    req.user._id,
            });
        }

        res.status(200).json({ success: true, assignment, submission });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/assignments
exports.createAssignment = async (req, res) => {
    try {
        const { title, course, dueDate, subject } = req.body;

        if (!title)   return res.status(400).json({ success: false, message: 'Title is required' });
        if (!course)  return res.status(400).json({ success: false, message: 'Course is required' });
        if (!dueDate) return res.status(400).json({ success: false, message: 'Due date is required' });

        const sanitized = {
            ...req.body,
            subject:       subject && subject.trim() !== '' ? subject : null,
            teacher:       req.user._id,
            attachmentUrl: req.file?.path || req.body.attachmentUrl || '',
        };

        const assignment = await Assignment.create(sanitized);
        const populated  = await Assignment.findById(assignment._id)
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
        if (req.body.subject !== undefined) {
            req.body.subject =
                req.body.subject && String(req.body.subject).trim() !== ''
                    ? req.body.subject
                    : null;
        }

        const assignment = await Assignment.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: false }
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

// POST /api/assignments/:id/upload
exports.uploadAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const assignment = await Assignment.findById(req.params.id);
        if (!assignment)
            return res.status(404).json({ success: false, message: 'Assignment not found' });

        // Delete old cloudinary file if exists
        if (assignment.attachmentUrl && assignment.attachmentUrl.includes('cloudinary')) {
            try {
                const { cloudinary } = require('../config/cloudinary');
                const publicId = assignment.attachmentUrl
                    .split('/').slice(-2).join('/').split('.')[0];
                await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            } catch (_) {}
        }

        assignment.attachmentUrl = req.file.path;
        await assignment.save();

        res.status(200).json({
            success: true,
            attachmentUrl: req.file.path,
            message: 'File uploaded successfully',
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/assignments/:id/upload
exports.removeAttachment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment)
            return res.status(404).json({ success: false, message: 'Assignment not found' });

        if (assignment.attachmentUrl && assignment.attachmentUrl.includes('cloudinary')) {
            try {
                const { cloudinary } = require('../config/cloudinary');
                const publicId = assignment.attachmentUrl
                    .split('/').slice(-2).join('/').split('.')[0];
                await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            } catch (_) {}
        }

        assignment.attachmentUrl = '';
        await assignment.save();

        res.status(200).json({ success: true, message: 'Attachment removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};