const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
    {
        period:  { type: Number, required: true },
        day: {
            type:     String,
            required: true,
            enum:     ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
        },
        subject: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Subject',
            default: null,
        },
        label:   { type: String, default: '' },
        isBreak: { type: Boolean, default: false },
    },
    { _id: false }
);

const periodSchema = new mongoose.Schema(
    {
        number:    { type: Number, required: true },
        startTime: { type: String, required: true },
        endTime:   { type: String, required: true },
        label:     { type: String, default: '' },
        isBreak:   { type: Boolean, default: false },
    },
    { _id: false }
);

const timetableSchema = new mongoose.Schema(
    {
        // ── Grade-based ──────────────────────────────────────────────────────────
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
        semester: {
            type:    Number,
            default: 1,
            min:     1,
            max:     4,
        },
        // ── Legacy course-based ──────────────────────────────────────────────────
        course: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Course',
            default: null,
        },
        // ── Common ───────────────────────────────────────────────────────────────
        term: {
            type:     String,
            required: [true, 'Term label is required'],
            trim:     true,
            // e.g. "2024-2025 Semester 1" or "Grade 7A — Semester 2"
        },
        workingDays: {
            type:    [String],
            enum:    ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
            default: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
        },
        periods: {
            type:     [periodSchema],
            validate: {
                validator: (v) => v.length > 0,
                message:   'At least one period is required',
            },
        },
        slots:    [slotSchema],
        isActive: { type: Boolean, default: true },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref:  'User',
        },
    },
    { timestamps: true }
);

// One active timetable per section per semester
timetableSchema.index({ section: 1, semester: 1, isActive: 1 }, { unique: true, sparse: true });
// Legacy: one per course+term
timetableSchema.index({ course: 1, term: 1 }, { unique: true, sparse: true });
timetableSchema.index({ academicYear: 1 });
timetableSchema.index({ grade: 1, semester: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);