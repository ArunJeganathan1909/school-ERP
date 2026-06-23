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
 *   Applies automatically to every student in that grade range, every year,
 *   forever — until deactivated. No need to recreate per academic year.
 *   e.g. "Mathematics" for "6-9", "Science" for "1-5"
 *
 * MODE B — Specific grade + stream (year-scoped, mainly for A/L):
 *   grade set (a specific Grade document, which is itself tied to one
 *   academicYear + stream), academicYear set to match that grade's year,
 *   gradeRange = null
 *   e.g. "Chemistry" for "Grade 12 — Science — 2024-2025"
 *
 * BUCKET DEFINITIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * null    → mandatory subject (auto-assigned)
 * string  → free-form bucket name, schools define their own per stream/grade
 *           e.g. "scienceBucket", "ictBucket", "commerceBucket", "religion"
 */

const subjectSchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, 'Subject name is required'], trim: true },
        code: { type: String, required: [true, 'Subject code is required'], uppercase: true, trim: true },

        // ── Scope: section only relevant when a teacher is assigned ─────────────
        section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },

        // ── Mode B fields ────────────────────────────────────────────────────────
        grade: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },

        // academicYear only meaningful for Mode B (specific grade).
        // For Mode A (gradeRange), this stays null — range subjects are
        // year-independent and persist automatically.
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

        // ── Teacher & scheduling ─────────────────────────────────────────────────
        teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        credits: { type: Number, default: 3, min: 1, max: 10 },
        description: { type: String, default: '' },
        schedule: [scheduleSchema],
        semester: { type: Number, default: 1, min: 1, max: 4 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Validation: exactly one of (gradeRange) or (grade) must be set, never both, never neither
// Validation: exactly one of (gradeRange) or (grade) must be set
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

    // Mode A: strip academicYear (range subjects are year-independent)
    if (hasRange && this.academicYear) {
        this.academicYear = null;
    }

    // Mode B: academicYear is required
    if (hasGrade && !this.academicYear) {
        throw new Error(
            'A subject scoped to a specific grade must also have an academicYear'
        );
    }
});

// Unique code scoping — different per mode since gradeRange has no academicYear
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
subjectSchema.index({ teacher: 1 });
subjectSchema.index({ isMandatory: 1, gradeRange: 1 });
subjectSchema.index({ gradeRange: 1, isActive: 1 });

module.exports = mongoose.model('Subject', subjectSchema);