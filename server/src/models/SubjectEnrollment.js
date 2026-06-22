const mongoose = require('mongoose');

/**
 * SubjectEnrollment
 * ─────────────────────────────────────────────────────────────────────────────
 * One document per student-subject pair per academic year.
 *
 * Created automatically for mandatory subjects when a student is assigned to a
 * section (via studentSectionController.assignStudent).
 *
 * Created by admin for bucket subjects via subjectEnrollmentController.
 *
 * bucket is now a free-form string matching Subject.bucket — schools define
 * their own bucket names per stream/grade (e.g. "scienceBucket", "ictBucket",
 * "commerceBucket", "religion", "firstLang", etc.)
 */
const subjectEnrollmentSchema = new mongoose.Schema(
    {
        student: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'User',
            required: [true, 'Student is required'],
        },
        subject: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'Subject',
            required: [true, 'Subject is required'],
        },
        section: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'Section',
            required: [true, 'Section is required'],
        },
        grade: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'Grade',
            required: [true, 'Grade is required'],
        },
        academicYear: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'AcademicYear',
            required: [true, 'Academic year is required'],
        },
        semester: {
            type:    Number,
            default: 1,
            min:     1,
            max:     4,
        },

        // ── How this enrollment was created ──────────────────────────────────────
        enrollmentType: {
            type:    String,
            enum:    ['mandatory', 'bucket'],
            default: 'mandatory',
        },
        bucket: {
            // Mirrors subject.bucket for quick queries.
            // Free-form: null for mandatory, any string for electives.
            type:    String,
            default: null,
            trim:    true,
        },

        // ── Status ───────────────────────────────────────────────────────────────
        status: {
            type:    String,
            enum:    ['active', 'dropped', 'completed'],
            default: 'active',
        },

        // ── Grade/marks ──────────────────────────────────────────────────────────
        marks: {
            type:    Number,
            default: null,
        },
        grade_letter: {
            type:    String,
            enum:    ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F', null],
            default: null,
        },
        remarks: {
            type:    String,
            default: '',
        },

        assignedBy: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'User',
            default: null,
        },
    },
    { timestamps: true }
);

// A student can only be enrolled in a subject once per academic year
subjectEnrollmentSchema.index({ student: 1, subject: 1, academicYear: 1 }, { unique: true });

// One bucket selection per student per bucket per academic year
// (bucket is a free-form string; sparse so null buckets are excluded)
subjectEnrollmentSchema.index(
    { student: 1, bucket: 1, academicYear: 1 },
    { unique: true, sparse: true }
);

subjectEnrollmentSchema.index({ section: 1, academicYear: 1, status: 1 });
subjectEnrollmentSchema.index({ student: 1, academicYear: 1, status: 1 });
subjectEnrollmentSchema.index({ subject: 1, academicYear: 1 });

module.exports = mongoose.model('SubjectEnrollment', subjectEnrollmentSchema);