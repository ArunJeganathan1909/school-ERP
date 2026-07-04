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
        // ── Link to shared structure ──────────────────────────────────────────────
        structureRef: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'TimetableStructure',
            default: null,
        },

        // ── Grade-based ───────────────────────────────────────────────────────────
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

        term: {
            type:     String,
            required: [true, 'Term label is required'],
            trim:     true,
        },
        workingDays: {
            type:    [String],
            enum:    ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
            default: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
        },
        periods:  [periodSchema],
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
timetableSchema.index(
    { section: 1, semester: 1 },
    { unique: true, sparse: true }
);
timetableSchema.index({ academicYear: 1 });
timetableSchema.index({ grade: 1, semester: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);