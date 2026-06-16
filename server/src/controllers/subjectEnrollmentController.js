const SubjectEnrollment = require('../models/SubjectEnrollment');
const Subject           = require('../models/Subject');
const StudentSection    = require('../models/StudentSection');

// ─── Internal helper (also called from studentSectionController) ──────────────
/**
 * Auto-enroll a student in all mandatory subjects for their grade/section.
 * Called when a student is first assigned (or re-assigned) to a section.
 *
 * @param {Object} params
 * @param {ObjectId} params.studentId
 * @param {ObjectId} params.sectionId
 * @param {ObjectId} params.gradeId
 * @param {Number}   params.gradeNumber   - e.g. 7
 * @param {ObjectId} params.academicYearId
 * @param {Number}   params.semester
 * @returns {{ enrolled: number, skipped: number }}
 */
exports.autoEnrollMandatory = async ({
                                         studentId,
                                         sectionId,
                                         gradeId,
                                         gradeNumber,
                                         academicYearId,
                                         semester = 1,
                                     }) => {
    const { gradeRangeFor } = require('./subjectController');
    const range = gradeRangeFor(gradeNumber);

    // Find all mandatory subjects for this grade/section/year
    const mandatorySubjects = await Subject.find({
        isMandatory:  true,
        isActive:     true,
        academicYear: academicYearId,
        $or: [
            { gradeRange: range },
            { section:    sectionId },
        ],
    });

    let enrolled = 0;
    let skipped  = 0;

    for (const subj of mandatorySubjects) {
        try {
            await SubjectEnrollment.create({
                student:        studentId,
                subject:        subj._id,
                section:        sectionId,
                grade:          gradeId,
                academicYear:   academicYearId,
                semester:       subj.semester || semester,
                enrollmentType: 'mandatory',
                bucket:         null,
                status:         'active',
            });
            enrolled++;
        } catch (err) {
            if (err.code === 11000) {
                skipped++; // already enrolled — fine on re-assign
            } else {
                throw err;
            }
        }
    }

    return { enrolled, skipped };
};

// ─── POST /api/subject-enrollments/bucket ─────────────────────────────────────
// Admin assigns a student's bucket subject choice
exports.assignBucketSubject = async (req, res) => {
    try {
        const { studentId, subjectId, academicYearId } = req.body;

        // Validate subject
        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }
        if (subject.isMandatory || !subject.bucket) {
            return res.status(400).json({
                success: false,
                message: 'This subject is not a bucket elective',
            });
        }

        // Validate student is in a section for this academic year
        const studentSection = await StudentSection.findOne({
            student:      studentId,
            academicYear: academicYearId,
            status:       'active',
        }).populate('grade', 'gradeNumber');

        if (!studentSection) {
            return res.status(404).json({
                success: false,
                message: 'Student has no active section assignment for this academic year',
            });
        }

        // Check if student already has a selection for this bucket
        const existingBucket = await SubjectEnrollment.findOne({
            student:      studentId,
            bucket:       subject.bucket,
            academicYear: academicYearId,
            status:       'active',
        }).populate('subject', 'name code');

        if (existingBucket) {
            return res.status(400).json({
                success: false,
                message: `Student already has "${existingBucket.subject.name}" selected for the ${subject.bucket} bucket. Drop it first to change.`,
                existing: existingBucket,
            });
        }

        const enrollment = await SubjectEnrollment.create({
            student:        studentId,
            subject:        subjectId,
            section:        studentSection.section,
            grade:          studentSection.grade._id,
            academicYear:   academicYearId,
            semester:       subject.semester || 1,
            enrollmentType: 'bucket',
            bucket:         subject.bucket,
            status:         'active',
            assignedBy:     req.user._id,
        });

        await enrollment.populate([
            { path: 'student', select: 'name email' },
            { path: 'subject', select: 'name code bucket' },
            { path: 'section', select: 'name' },
        ]);

        res.status(201).json({ success: true, enrollment });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Student is already enrolled in this subject',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/subject-enrollments/bucket/change ──────────────────────────────
// Admin changes a student's bucket selection (drops old, assigns new)
exports.changeBucketSubject = async (req, res) => {
    try {
        const { studentId, newSubjectId, academicYearId } = req.body;

        const newSubject = await Subject.findById(newSubjectId);
        if (!newSubject || newSubject.isMandatory || !newSubject.bucket) {
            return res.status(400).json({ success: false, message: 'Invalid bucket subject' });
        }

        // Drop existing selection for this bucket
        const dropped = await SubjectEnrollment.findOneAndUpdate(
            { student: studentId, bucket: newSubject.bucket, academicYear: academicYearId, status: 'active' },
            { $set: { status: 'dropped' } },
            { new: true }
        );

        // Assign new selection
        const studentSection = await StudentSection.findOne({
            student:      studentId,
            academicYear: academicYearId,
            status:       'active',
        });

        const enrollment = await SubjectEnrollment.create({
            student:        studentId,
            subject:        newSubjectId,
            section:        studentSection.section,
            grade:          studentSection.grade,
            academicYear:   academicYearId,
            semester:       newSubject.semester || 1,
            enrollmentType: 'bucket',
            bucket:         newSubject.bucket,
            status:         'active',
            assignedBy:     req.user._id,
        });

        await enrollment.populate([
            { path: 'student', select: 'name email' },
            { path: 'subject', select: 'name code bucket' },
        ]);

        res.status(200).json({
            success: true,
            message: `Bucket changed from "${dropped?.subject}" to "${newSubject.name}"`,
            enrollment,
            dropped,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subject-enrollments/student/:studentId ─────────────────────────
// All subjects (mandatory + bucket) for a student in a given academic year
exports.getStudentSubjects = async (req, res) => {
    try {
        const { academicYear, semester } = req.query;
        const filter = {
            student: req.params.studentId,
            status:  'active',
        };
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);

        const enrollments = await SubjectEnrollment.find(filter)
            .populate('subject', 'name code bucket isMandatory schedule teacher credits')
            .populate('section', 'name')
            .populate({
                path:   'subject',
                select: 'name code bucket isMandatory credits semester schedule',
                populate: { path: 'teacher', select: 'name email profilePhoto' },
            })
            .sort({ enrollmentType: 1, bucket: 1 });
        // mandatory first, then buckets

        // Group for easy frontend consumption
        const mandatory = enrollments.filter(e => e.enrollmentType === 'mandatory');
        const buckets   = enrollments.filter(e => e.enrollmentType === 'bucket');

        res.status(200).json({ success: true, enrollments, mandatory, buckets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subject-enrollments/my ─────────────────────────────────────────
// Student views their own subject list
exports.getMySubjects = async (req, res) => {
    try {
        const { academicYear, semester } = req.query;
        const filter = {
            student: req.user._id,
            status:  'active',
        };
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);

        const enrollments = await SubjectEnrollment.find(filter)
            .populate({
                path:   'subject',
                select: 'name code bucket isMandatory credits semester description schedule',
                populate: { path: 'teacher', select: 'name email profilePhoto' },
            })
            .populate('section', 'name room')
            .sort({ enrollmentType: 1, 'subject.name': 1 });

        const mandatory = enrollments.filter(e => e.enrollmentType === 'mandatory');
        const buckets   = enrollments.filter(e => e.enrollmentType === 'bucket');

        res.status(200).json({ success: true, enrollments, mandatory, buckets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subject-enrollments/subject/:subjectId ─────────────────────────
// Admin/teacher: all students enrolled in a subject
exports.getSubjectStudents = async (req, res) => {
    try {
        const { academicYear, status = 'active' } = req.query;
        const filter = { subject: req.params.subjectId, status };
        if (academicYear) filter.academicYear = academicYear;

        const enrollments = await SubjectEnrollment.find(filter)
            .populate('student', 'name email phone profilePhoto rollNumber admissionNumber')
            .populate('section', 'name')
            .sort({ 'student.name': 1 });

        res.status(200).json({ success: true, enrollments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subject-enrollments/section/:sectionId/pending-buckets ─────────
// Returns students who are missing bucket selections — useful admin checklist
exports.getPendingBucketSelections = async (req, res) => {
    try {
        const { academicYearId } = req.query;
        const BUCKETS = ['bucket1', 'religion', 'firstLang', 'secondLang'];

        // Get all active students in this section
        const StudentSection = require('../models/StudentSection');
        const students = await StudentSection.find({
            section:      req.params.sectionId,
            academicYear: academicYearId,
            status:       'active',
        }).populate('student', 'name email rollNumber');

        // For each student, check which buckets are unfilled
        const results = [];
        for (const ss of students) {
            const filledBuckets = await SubjectEnrollment.distinct('bucket', {
                student:      ss.student._id,
                academicYear: academicYearId,
                status:       'active',
                bucket:       { $ne: null },
            });

            const missingBuckets = BUCKETS.filter(b => !filledBuckets.includes(b));
            if (missingBuckets.length > 0) {
                results.push({
                    student:        ss.student,
                    rollNumber:     ss.rollNumber,
                    filledBuckets,
                    missingBuckets,
                });
            }
        }

        res.status(200).json({ success: true, pending: results, total: results.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/subject-enrollments/:id/marks — teacher/admin ──────────────────
exports.enterMarks = async (req, res) => {
    try {
        const { marks, grade_letter, remarks } = req.body;

        const enrollment = await SubjectEnrollment.findByIdAndUpdate(
            req.params.id,
            { $set: { marks, grade_letter, remarks, status: 'completed' } },
            { new: true }
        )
            .populate('student', 'name email')
            .populate('subject', 'name code');

        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Enrollment not found' });
        }

        res.status(200).json({ success: true, enrollment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subject-enrollments — admin: all with filters ──────────────────
exports.getAll = async (req, res) => {
    try {
        const { student, subject, section, academicYear, status, bucket, page = 1, limit = 30 } = req.query;
        const filter = {};
        if (student)      filter.student      = student;
        if (subject)      filter.subject      = subject;
        if (section)      filter.section      = section;
        if (academicYear) filter.academicYear = academicYear;
        if (status)       filter.status       = status;
        if (bucket)       filter.bucket       = bucket;

        const skip = (Number(page) - 1) * Number(limit);

        const [enrollments, total] = await Promise.all([
            SubjectEnrollment.find(filter)
                .populate('student', 'name email rollNumber')
                .populate('subject', 'name code bucket isMandatory')
                .populate('section', 'name')
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 }),
            SubjectEnrollment.countDocuments(filter),
        ]);

        res.status(200).json({ success: true, total, enrollments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};