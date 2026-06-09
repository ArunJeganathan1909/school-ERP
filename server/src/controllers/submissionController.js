const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const { notify } = require('../socket/socketHelpers');

// POST /api/submissions — student submits
exports.submitAssignment = async (req, res) => {
    try {
        const { assignmentId, textAnswer, fileUrl } = req.body;

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

        const isLate = new Date() > new Date(assignment.dueDate);
        if (isLate && !assignment.allowLateSubmission) {
            return res.status(400).json({ success: false, message: 'Due date has passed. Late submissions not allowed.' });
        }

        // Upsert — allow re-submission before deadline
        const submission = await Submission.findOneAndUpdate(
            { assignment: assignmentId, student: req.user._id },
            {
                $set: {
                    textAnswer,
                    fileUrl,
                    isLate,
                    submittedAt: Date.now(),
                    status: 'submitted',
                    course: assignment.course,
                    marks: null,
                    feedback: '',
                },
            },
            { new: true, upsert: true }
        );

        res.status(201).json({ success: true, submission });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/submissions/assignment/:assignmentId — teacher/admin: all submissions for an assignment
exports.getAssignmentSubmissions = async (req, res) => {
    try {
        const submissions = await Submission.find({ assignment: req.params.assignmentId })
            .populate('student', 'name email profilePhoto')
            .sort({ submittedAt: -1 });

        res.status(200).json({ success: true, submissions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/submissions/my?course=id — student: own submissions
exports.getMySubmissions = async (req, res) => {
    try {
        const filter = { student: req.user._id };
        if (req.query.course) filter.course = req.query.course;

        const submissions = await Submission.find(filter)
            .populate('assignment', 'title totalMarks dueDate')
            .sort({ submittedAt: -1 });

        res.status(200).json({ success: true, submissions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/submissions/:id/grade — teacher grades a submission
exports.gradeSubmission = async (req, res) => {
    try {
        const { marks, feedback } = req.body;

        const submission = await Submission.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    marks,
                    feedback,
                    status: 'graded',
                    gradedAt: Date.now(),
                    gradedBy: req.user._id,
                },
            },
            { new: true }
        ).populate('student', 'name email')
            .populate('assignment', 'title');

        if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

        res.status(200).json({ success: true, submission });
        await notify({
            recipientId: submission.student._id,
            type: 'assignment_graded',
            title: 'Assignment graded',
            message: `Your submission for "${submission.assignment?.title || 'an assignment'}" has been graded.`,
            link: '/assignments',
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/submissions/:id — teacher/admin: remove a single submission
exports.deleteSubmission = async (req, res) => {
    try {
        const submission = await Submission.findByIdAndDelete(req.params.id);
        if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
        res.status(200).json({ success: true, message: 'Submission deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};