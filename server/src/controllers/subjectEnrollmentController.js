const SubjectEnrollment = require('../models/SubjectEnrollment');
const Subject           = require('../models/Subject');
const StudentSection    = require('../models/StudentSection');

// ─── Internal helper ──────────────────────────────────────────────────────────
exports.autoEnrollMandatory = async ({
                                         studentId, sectionId, gradeId, gradeNumber, academicYearId, semester = 1,
                                     }) => {
    const { gradeRangeFor } = require('./subjectController');
    const range = gradeRangeFor(gradeNumber);

    const mandatorySubjects = await Subject.find({
        isMandatory: true,
        isActive:    true,
        $or: [
            { gradeRange: range },                            // Mode A — year-independent
            { grade: gradeId, academicYear: academicYearId },  // Mode B — year-scoped (A/L)
        ],
    });

    let enrolled = 0, skipped = 0;
    for (const subj of mandatorySubjects) {
        try {
            await SubjectEnrollment.create({
                student: studentId, subject: subj._id, section: sectionId,
                grade: gradeId, academicYear: academicYearId,
                semester: subj.semester || semester,
                enrollmentType: 'mandatory', bucket: null, status: 'active',
            });
            enrolled++;
        } catch (err) {
            if (err.code === 11000) { skipped++; } else throw err;
        }
    }
    return { enrolled, skipped };
};

// ─── POST /api/subject-enrollments/bucket ─────────────────────────────────────
exports.assignBucketSubject = async (req, res) => {
    try {
        const { studentId, subjectId, academicYearId } = req.body;

        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }
        if (subject.isMandatory || !subject.bucket) {
            return res.status(400).json({ success: false, message: 'This subject is not a bucket elective' });
        }

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

        const existingBucket = await SubjectEnrollment.findOne({
            student:      studentId,
            bucket:       subject.bucket,
            academicYear: academicYearId,
            status:       'active',
        }).populate('subject', 'name code');

        if (existingBucket) {
            return res.status(400).json({
                success: false,
                message: `Student already has "${existingBucket.subject.name}" for the "${subject.bucket}" bucket. Drop it first or use the change endpoint.`,
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
            return res.status(400).json({ success: false, message: 'Student is already enrolled in this subject' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/subject-enrollments/bucket/change ──────────────────────────────
exports.changeBucketSubject = async (req, res) => {
    try {
        const { studentId, newSubjectId, academicYearId } = req.body;

        const newSubject = await Subject.findById(newSubjectId);
        if (!newSubject || newSubject.isMandatory || !newSubject.bucket) {
            return res.status(400).json({ success: false, message: 'Invalid bucket subject' });
        }

        const dropped = await SubjectEnrollment.findOneAndUpdate(
            { student: studentId, bucket: newSubject.bucket, academicYear: academicYearId, status: 'active' },
            { $set: { status: 'dropped' } },
            { new: true }
        );

        const studentSection = await StudentSection.findOne({
            student: studentId, academicYear: academicYearId, status: 'active',
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
            message: `Bucket "${newSubject.bucket}" changed to "${newSubject.name}"`,
            enrollment,
            dropped,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subject-enrollments/student/:studentId ─────────────────────────
exports.getStudentSubjects = async (req, res) => {
    try {
        const { academicYear, semester } = req.query;
        const filter = { student: req.params.studentId, status: 'active' };
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);

        const SubjectTeacherAssignment = require('../models/SubjectTeacherAssignment');

        const enrollments = await SubjectEnrollment.find(filter)
            .populate('subject', 'name code bucket isMandatory credits semester schedule')
            .populate('section', 'name')
            .sort({ enrollmentType: 1, bucket: 1 })
            .lean();

        // Attach the right teacher per enrollment via SubjectTeacherAssignment
        // (subject+section pair → teacher)
        const withTeachers = await Promise.all(
            enrollments.map(async (e) => {
                const assignment = await SubjectTeacherAssignment.findOne({
                    subject: e.subject._id,
                    section: e.section._id,
                }).populate('teacher', 'name email profilePhoto');
                return { ...e, subject: { ...e.subject, teacher: assignment?.teacher || null } };
            })
        );

        const mandatory = withTeachers.filter(e => e.enrollmentType === 'mandatory');
        const buckets   = withTeachers.filter(e => e.enrollmentType === 'bucket');

        res.status(200).json({ success: true, enrollments: withTeachers, mandatory, buckets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subject-enrollments/my ─────────────────────────────────────────
exports.getMySubjects = async (req, res) => {
    try {
        const { academicYear, semester } = req.query;
        const filter = { student: req.user._id, status: 'active' };
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);

        const SubjectTeacherAssignment = require('../models/SubjectTeacherAssignment');

        const enrollments = await SubjectEnrollment.find(filter)
            .populate('subject', 'name code bucket isMandatory credits semester description schedule')
            .populate('section', 'name room')
            .sort({ enrollmentType: 1, 'subject.name': 1 })
            .lean();

        // Attach the right teacher per enrollment via SubjectTeacherAssignment
        // (subject+section pair → teacher)
        const withTeachers = await Promise.all(
            enrollments.map(async (e) => {
                const assignment = await SubjectTeacherAssignment.findOne({
                    subject: e.subject._id,
                    section: e.section._id,
                }).populate('teacher', 'name email profilePhoto');
                return { ...e, subject: { ...e.subject, teacher: assignment?.teacher || null } };
            })
        );

        const mandatory = withTeachers.filter(e => e.enrollmentType === 'mandatory');
        const buckets   = withTeachers.filter(e => e.enrollmentType === 'bucket');

        res.status(200).json({ success: true, enrollments: withTeachers, mandatory, buckets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subject-enrollments/subject/:subjectId ─────────────────────────
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
/**
 * Now DYNAMIC: instead of hardcoding ['bucket1','religion','firstLang','secondLang'],
 * we look up which buckets actually exist for this section's grade + academic year.
 * This means a Science-stream A/L section will check "scienceBucket" & "ictBucket",
 * while a Commerce section checks "commerceBucket" & "ictBucket", etc.
 */
exports.getPendingBucketSelections = async (req, res) => {
    try {
        const { academicYearId } = req.query;

        // Resolve section → grade → gradeRange, then find all bucket names for this scope
        const Section = require('../models/Section');
        const { gradeRangeFor } = require('./subjectController');

        const section = await Section.findById(req.params.sectionId).populate('grade', 'gradeNumber');
        if (!section) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        const range = gradeRangeFor(section.grade?.gradeNumber);

        // Find all distinct bucket names for this section/grade scope
        const bucketFilter = {
            isMandatory:  false,
            isActive:     true,
            bucket:       { $ne: null },
            academicYear: academicYearId,
            $or: [
                { section: req.params.sectionId },
                { grade: section.grade._id },
            ],
        };
        if (range) bucketFilter.$or.push({ gradeRange: range });

        const BUCKETS = await Subject.distinct('bucket', bucketFilter);

        if (BUCKETS.length === 0) {
            return res.status(200).json({
                success: true,
                pending: [],
                total: 0,
                message: 'No bucket subjects defined for this section yet.',
            });
        }

        const students = await StudentSection.find({
            section:      req.params.sectionId,
            academicYear: academicYearId,
            status:       'active',
        }).populate('student', 'name email rollNumber');

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

        res.status(200).json({ success: true, pending: results, total: results.length, buckets: BUCKETS });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/subject-enrollments/:id/marks ───────────────────────────────────
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

// ─── GET /api/subject-enrollments ─────────────────────────────────────────────
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
                .skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
            SubjectEnrollment.countDocuments(filter),
        ]);

        res.status(200).json({ success: true, total, enrollments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── POST /api/subject-enrollments/sync/:studentId ───────────────────────────
// Retroactively enrolls a student into any mandatory subjects matching their
// CURRENT section/grade that were created or now match AFTER the student was
// originally assigned (autoEnrollMandatory only runs once, at assignment time).
exports.syncMandatoryEnrollments = async (req, res) => {
    try {
        const StudentSection = require('../models/StudentSection');

        const studentSection = await StudentSection.findOne({
            student: req.params.studentId,
            status:  'active',
        }).populate('grade', 'gradeNumber');

        if (!studentSection) {
            return res.status(404).json({
                success: false,
                message: 'Student has no active section assignment',
            });
        }

        const { enrolled, skipped } = await exports.autoEnrollMandatory({
            studentId:      req.params.studentId,
            sectionId:      studentSection.section,
            gradeId:        studentSection.grade._id,
            gradeNumber:    studentSection.grade?.gradeNumber,
            academicYearId: studentSection.academicYear,
            semester:       1,
        });

        res.status(200).json({
            success: true,
            message: enrolled > 0
                ? `Synced ${enrolled} new mandatory subject(s).`
                : 'No new mandatory subjects to sync — already up to date.',
            enrolled,
            skipped,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── POST /api/subject-enrollments/sync-all ───────────────────────────────────
// Bulk version — syncs every active student in every active section.
// Useful right after creating a new mandatory subject so it retroactively
// reaches everyone already assigned.
exports.syncAllMandatoryEnrollments = async (req, res) => {
    try {
        const StudentSection = require('../models/StudentSection');

        const activeAssignments = await StudentSection.find({ status: 'active' })
            .populate('grade', 'gradeNumber');

        let totalEnrolled = 0;
        let studentsAffected = 0;

        for (const sa of activeAssignments) {
            const { enrolled } = await exports.autoEnrollMandatory({
                studentId:      sa.student,
                sectionId:      sa.section,
                gradeId:        sa.grade._id,
                gradeNumber:    sa.grade?.gradeNumber,
                academicYearId: sa.academicYear,
                semester:       1,
            });
            if (enrolled > 0) {
                totalEnrolled += enrolled;
                studentsAffected++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Synced ${totalEnrolled} new enrollment(s) across ${studentsAffected} student(s).`,
            totalEnrolled,
            studentsAffected,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};