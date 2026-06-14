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
        // ── Grade-based school subjects ──────────────────────────────────────────
        section: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Section',
            default: null,
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
        // ── Diploma/Degree course subjects (legacy) ───────────────────────────────
        course: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Course',
            default: null,
        },
        // ── Common fields ────────────────────────────────────────────────────────
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
        schedule:  [scheduleSchema],
        semester: {
            type:    Number,
            default: 1,
            min:     1,
            max:     4,
        },
        isElective: {
            type:    Boolean,
            default: false,
        },
        isActive: {
            type:    Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Grade-based subject: unique code per section per semester
subjectSchema.index({ section: 1, code: 1, semester: 1 }, { unique: true, sparse: true });
// Course-based subject: unique code per course (legacy)
subjectSchema.index({ course: 1, code: 1 }, { unique: true, sparse: true });
subjectSchema.index({ grade: 1, academicYear: 1, semester: 1 });
subjectSchema.index({ teacher: 1 });

module.exports = mongoose.model('Subject', subjectSchema);