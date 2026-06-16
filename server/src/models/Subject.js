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
 * BUCKET DEFINITIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * null          → mandatory subject (auto-assigned to all students in grade)
 * "bucket1"     → Art / Music / Dance  (pick 1)
 * "religion"    → Hindu / Islam / Buddhist / Christianity  (pick 1)
 * "firstLang"   → Tamil / Sinhala  (pick 1)
 * "secondLang"  → Tamil / Sinhala  (pick 1)
 *
 * GRADE RANGES (used for auto-assignment of mandatory subjects)
 * ─────────────────────────────────────────────────────────────────────────────
 * "1-5"   → Grade 1–5   (Primary)
 * "6-9"   → Grade 6–9   (Junior Secondary)
 * "10-11" → Grade 10–11 (O/L)
 * "12-13" → Grade 12–13 (A/L)
 * null    → applies to a specific section only (not grade-range wide)
 */

const subjectSchema = new mongoose.Schema(
    {
        name: {
            type:     String,
            required: [true, 'Subject name is required'],
            trim:     true,
        },
        code: {
            type:      String,
            required:  [true, 'Subject code is required'],
            uppercase: true,
            trim:      true,
        },

        // ── Scope ────────────────────────────────────────────────────────────────
        section: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Section',
            default: null,
            // When set: subject belongs to one specific section (e.g. 6A Maths)
        },
        grade: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Grade',
            default: null,
        },
        academicYear: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'AcademicYear',
            default: null,
        },

        // ── Mandatory / Bucket logic ─────────────────────────────────────────────
        isMandatory: {
            type:    Boolean,
            default: true,
            // true  → auto-assigned to every student in the grade range / section
            // false → student (via admin) must choose from the bucket
        },
        bucket: {
            type:    String,
            enum:    ['bucket1', 'religion', 'firstLang', 'secondLang', null],
            default: null,
            // null = mandatory; otherwise names the elective group this belongs to
        },

        // ── Grade range for auto-assignment ──────────────────────────────────────
        gradeRange: {
            type:    String,
            enum:    ['1-5', '6-9', '10-11', '12-13', null],
            default: null,
            // e.g. "6-9" means this subject template is mandatory for all grades 6–9
            // Used when creating a subject that spans multiple grades automatically
        },

        // ── Teacher & scheduling ─────────────────────────────────────────────────
        teacher: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'User',
            default: null,
        },
        credits: {
            type:    Number,
            default: 3,
            min:     1,
            max:     10,
        },
        description: {
            type:    String,
            default: '',
        },
        schedule: [scheduleSchema],
        semester: {
            type:    Number,
            default: 1,
            min:     1,
            max:     4,
        },
        isActive: {
            type:    Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Unique subject code per section per semester
subjectSchema.index({ section: 1, code: 1, semester: 1 }, { unique: true, sparse: true });
subjectSchema.index({ grade: 1, academicYear: 1, semester: 1 });
subjectSchema.index({ bucket: 1, grade: 1 });
subjectSchema.index({ teacher: 1 });
subjectSchema.index({ isMandatory: 1, gradeRange: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
