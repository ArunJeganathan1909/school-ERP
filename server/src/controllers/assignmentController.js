const Assignment              = require('../models/Assignment');
const Submission               = require('../models/Submission');
const SubjectEnrollment        = require('../models/SubjectEnrollment');
const SubjectTeacherAssignment = require('../models/SubjectTeacherAssignment');
const { notify }                = require('../socket/socketHelpers');

// GET /api/assignments?subject=&section=
exports.getAssignments = async (req, res) => {
    try {
        const { subject, section } = req.query;
        const filter = {};
        if (subject) filter.subject = subject;
        if (section) filter.section = section;
        if (req.user.role === 'student') filter.isPublished = true;

        const assignments = await Assignment.find(filter)
            .populate('subject', 'name code')
            .populate('section', 'name')
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
            .populate('section', 'name')
            .populate('teacher', 'name profilePhoto');

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

// GET /api/assignments/teacher/subjects?section=id
// Returns the subjects this teacher is assigned to teach (via
// SubjectTeacherAssignment), optionally filtered by section.
exports.getMySubjects = async (req, res) => {
    try {
        const { section } = req.query;
        const filter = { teacher: req.user._id, isActive: true };
        if (section && section.trim()) filter.section = section.trim();

        const assignments = await SubjectTeacherAssignment.find(filter)
            .populate('subject', 'name code')
            .populate({
                path: 'section',
                select: 'name grade',
                populate: { path: 'grade', select: 'gradeNumber name stream' },
            })
            .sort({ 'subject.name': 1 });

        // De-duplicate subjects (a teacher may teach the same subject in
        // multiple sections) while keeping the list of sections per subject
        const grouped = {};
        assignments.forEach((a) => {
            const sid = String(a.subject?._id);
            if (!grouped[sid]) {
                grouped[sid] = { subject: a.subject, sections: [] };
            }
            grouped[sid].sections.push(a.section);
        });

        res.status(200).json({ success: true, subjects: Object.values(grouped) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/assignments
exports.createAssignment = async (req, res) => {
    try {
        const { title, subject, dueDate, section } = req.body;

        if (!title)   return res.status(400).json({ success: false, message: 'Title is required' });
        if (!subject) return res.status(400).json({ success: false, message: 'Subject is required' });
        if (!dueDate) return res.status(400).json({ success: false, message: 'Due date is required' });

        // Verify this teacher is actually assigned to teach this subject
        // (admins bypass this check)
        if (req.user.role === 'teacher') {
            const isAssigned = await SubjectTeacherAssignment.findOne({
                teacher: req.user._id,
                subject,
                isActive: true,
                ...(section ? { section } : {}),
            });
            if (!isAssigned) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not assigned to teach this subject' + (section ? ' for this section' : ''),
                });
            }
        }

        const sanitized = {
            ...req.body,
            section: section && section.trim() !== '' ? section : null,
            teacher: req.user._id,
        };

        const assignment = await Assignment.create(sanitized);

        const populated = await Assignment.findById(assignment._id)
            .populate('subject', 'name code')
            .populate('section', 'name')
            .populate('teacher', 'name');

        res.status(201).json({ success: true, assignment: populated });

        // ── Notify students enrolled in this subject ──
        // If a section was specified, only notify students in that section's
        // enrollment record; otherwise notify everyone enrolled in the subject.
        try {
            const enrollFilter = { subject: populated.subject._id, status: 'active' };
            if (populated.section) enrollFilter.section = populated.section._id;

            const enrollments = await SubjectEnrollment.find(enrollFilter).select('student');
            const studentIds  = enrollments.map((e) => e.student);

            if (studentIds.length > 0) {
                const subjectName = populated.subject?.name || 'your subject';
                const due = new Date(populated.dueDate).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                });

                await notify({
                    recipientId: studentIds,
                    type:    'assignment_due',
                    title:   '📝 New assignment posted',
                    message: `"${populated.title}" has been posted for ${subjectName}. Due: ${due}.`,
                    link:    '/assignments',
                });
            }
        } catch (notifErr) {
            console.error('Assignment notification error:', notifErr.message);
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/assignments/:id
exports.updateAssignment = async (req, res) => {
    try {
        if (req.body.section !== undefined) {
            req.body.section =
                req.body.section && String(req.body.section).trim() !== ''
                    ? req.body.section
                    : null;
        }

        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });

        if (req.user.role === 'teacher' && String(assignment.teacher) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const updated = await Assignment.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        )
            .populate('subject', 'name code')
            .populate('section', 'name');

        res.status(200).json({ success: true, assignment: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/assignments/:id
exports.deleteAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });

        if (req.user.role === 'teacher' && String(assignment.teacher) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await assignment.deleteOne();
        await Submission.deleteMany({ assignment: req.params.id });
        res.status(200).json({ success: true, message: 'Assignment and all submissions deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/assignments/student/mine
// Returns all published assignments for subjects the student is enrolled in
// (mandatory + bucket electives), restricted to their own section where the
// assignment is section-specific.
exports.getStudentAssignments = async (req, res) => {
    try {
        const enrollments = await SubjectEnrollment.find({
            student: req.user._id,
            status:  'active',
        }).select('subject section');

        if (enrollments.length === 0) {
            return res.status(200).json({ success: true, assignments: [] });
        }

        const subjectIds = enrollments.map((e) => e.subject);
        const sectionIds  = enrollments.map((e) => e.section).filter(Boolean);

        const assignments = await Assignment.find({
            subject: { $in: subjectIds },
            isPublished: true,
            $or: [
                { section: null },                  // applies to every section
                { section: { $in: sectionIds } },   // applies to the student's section
            ],
        })
            .populate('subject', 'name code')
            .populate('section', 'name')
            .populate('teacher', 'name')
            .sort({ dueDate: 1 });

        res.status(200).json({ success: true, assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};