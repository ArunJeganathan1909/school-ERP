const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
    {
        day:       { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
        startTime: String,
        endTime:   String,
        room:      String,
    },
    { _id: false }
);

/**
 * SUBJECT SCOPING — two mutually exclusive modes
 * ─────────────────────────────────────────────────────────────────────────────
 * MODE A — Grade range (year-independent):
 *   gradeRange set, grade = null, academicYear = null
 *
 * MODE B — Specific grade + stream (year-scoped, mainly for A/L):
 *   grade set, academicYear set, gradeRange = null
 *
 * TEACHER ASSIGNMENT
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved OUT of this model entirely — see SubjectTeacherAssignment.
 * One subject can have a DIFFERENT teacher per section
 * (e.g. Maths 9A → Teacher1, Maths 9B → Teacher2).
 *
 * BUCKET DEFINITIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * null    → mandatory subject (auto-assigned)
 * string  → free-form bucket name, schools define their own per stream/grade
 */

const subjectSchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, 'Subject name is required'], trim: true },
        code: { type: String, required: [true, 'Subject code is required'], uppercase: true, trim: true },

        // ── Mode B fields ────────────────────────────────────────────────────────
        grade: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },
        academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', default: null },

        // ── Mode A field ─────────────────────────────────────────────────────────
        gradeRange: {
            type: String,
            enum: ['1-5', '6-9', '10-11', '12-13', null],
            default: null,
        },

        // ── Mandatory / Bucket logic ─────────────────────────────────────────────
        isMandatory: { type: Boolean, default: true },
        bucket: { type: String, default: null, trim: true },

        // ── Scheduling (teacher removed — see SubjectTeacherAssignment) ─────────
        credits: { type: Number, default: 3, min: 1, max: 10 },
        description: { type: String, default: '' },
        schedule: [scheduleSchema],
        semester: { type: Number, default: 1, min: 1, max: 4 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

subjectSchema.pre('validate', async function () {
    const hasRange = !!this.gradeRange;
    const hasGrade = !!this.grade;

    if (hasRange === hasGrade) {
        throw new Error(
            hasRange
                ? 'A subject cannot have both a grade range AND a specific grade — choose one mode'
                : 'A subject must have either a grade range (e.g. "6-9") or a specific grade (for A/L stream subjects)'
        );
    }

    if (hasRange && this.academicYear) {
        this.academicYear = null;
    }

    if (hasGrade && !this.academicYear) {
        throw new Error('A subject scoped to a specific grade must also have an academicYear');
    }
});

subjectSchema.index(
    { gradeRange: 1, code: 1, semester: 1, bucket: 1 },
    { unique: true, partialFilterExpression: { gradeRange: { $type: 'string' } } }
);
subjectSchema.index(
    { grade: 1, code: 1, semester: 1 },
    { unique: true, partialFilterExpression: { grade: { $type: 'objectId' } } }
);

subjectSchema.index({ bucket: 1, gradeRange: 1 });
subjectSchema.index({ bucket: 1, grade: 1 });
subjectSchema.index({ isMandatory: 1, gradeRange: 1 });
subjectSchema.index({ gradeRange: 1, isActive: 1 });

module.exports = mongoose.model('Subject', subjectSchema);