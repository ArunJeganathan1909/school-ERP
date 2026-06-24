const SubjectTeacherAssignment = require('../models/SubjectTeacherAssignment');
const Subject  = require('../models/Subject');
const Section  = require('../models/Section');

// GET /api/subject-teacher-assignments?subject=&section=&teacher=&grade=
exports.getAll = async (req, res) => {
    try {
        const { subject, section, teacher, grade, isActive } = req.query;
        const filter = {};
        if (subject)  filter.subject  = subject;
        if (section)  filter.section  = section;
        if (teacher)  filter.teacher  = teacher;
        if (grade)    filter.grade    = grade;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const assignments = await SubjectTeacherAssignment.find(filter)
            .populate('subject', 'name code gradeRange grade bucket isMandatory')
            .populate({
                path: 'section',
                select: 'name grade',
                populate: { path: 'grade', select: 'name gradeNumber stream' },
            })
            .populate('teacher', 'name email profilePhoto')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/subject-teacher-assignments/by-subject/:subjectId
// Returns every section→teacher pairing for one subject — used by ManageSubjects
// to render the full assignment list per subject.
exports.getBySubject = async (req, res) => {
    try {
        const assignments = await SubjectTeacherAssignment.find({ subject: req.params.subjectId })
            .populate({
                path: 'section',
                select: 'name grade capacity',
                populate: { path: 'grade', select: 'name gradeNumber stream' },
            })
            .populate('teacher', 'name email profilePhoto')
            .sort({ 'section.grade.gradeNumber': 1 });

        res.status(200).json({ success: true, assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/subject-teacher-assignments/my-teaching
// Teacher: every subject+section they're assigned to teach
exports.getMyTeaching = async (req, res) => {
    try {
        const assignments = await SubjectTeacherAssignment.find({ teacher: req.user._id, isActive: true })
            .populate('subject', 'name code bucket isMandatory semester credits')
            .populate({
                path: 'section',
                select: 'name room',
                populate: { path: 'grade', select: 'name gradeNumber stream' },
            })
            .sort({ 'section.grade.gradeNumber': 1 });

        res.status(200).json({ success: true, assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/subject-teacher-assignments
// Body: { subjectId, sectionId, teacherId }
// Creates OR updates the teacher for that subject+section pair (upsert-style)
exports.assignTeacher = async (req, res) => {
    try {
        const { subjectId, sectionId, teacherId } = req.body;

        const [subject, section] = await Promise.all([
            Subject.findById(subjectId),
            Section.findById(sectionId).populate('grade', 'gradeNumber'),
        ]);

        if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
        if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

        // Validate the section actually falls within the subject's scope
        if (subject.gradeRange) {
            const { gradeRangeFor } = require('./subjectController');
            const range = gradeRangeFor(section.grade?.gradeNumber);
            if (range !== subject.gradeRange) {
                return res.status(400).json({
                    success: false,
                    message: `This section's grade (${section.grade?.gradeNumber}) is not within the subject's range (${subject.gradeRange})`,
                });
            }
        } else if (subject.grade && String(subject.grade) !== String(section.grade?._id)) {
            return res.status(400).json({
                success: false,
                message: 'This section does not belong to the subject\'s specific grade',
            });
        }

        const assignment = await SubjectTeacherAssignment.findOneAndUpdate(
            { subject: subjectId, section: sectionId },
            {
                $set: {
                    teacher:    teacherId,
                    grade:      section.grade?._id || null,
                    isActive:   true,
                    assignedBy: req.user._id,
                },
            },
            { new: true, upsert: true, runValidators: true }
        )
            .populate('subject', 'name code')
            .populate({ path: 'section', select: 'name', populate: { path: 'grade', select: 'gradeNumber name' } })
            .populate('teacher', 'name email');

        res.status(200).json({ success: true, assignment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/subject-teacher-assignments/:id
exports.removeAssignment = async (req, res) => {
    try {
        const assignment = await SubjectTeacherAssignment.findByIdAndDelete(req.params.id);
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        res.status(200).json({ success: true, message: 'Teacher unassigned from this section' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};