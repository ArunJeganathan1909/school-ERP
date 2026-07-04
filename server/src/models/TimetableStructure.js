const mongoose = require('mongoose');

const periodSchema = new mongoose.Schema(
    {
        number:    { type: Number, required: true },
        startTime: { type: String, required: true },  // "07:30"
        endTime:   { type: String, required: true },  // "08:10"
        label:     { type: String, default: '' },
        isBreak:   { type: Boolean, default: false },
    },
    { _id: false }
);

/**
 * TimetableStructure
 * ─────────────────────────────────────────────────────────────────────────────
 * One shared period/day structure per academic year (optionally per semester).
 * All section-level timetables inherit this structure — admins only define
 * working days and period times ONCE, then build each section's subject grid.
 */
const timetableStructureSchema = new mongoose.Schema(
    {
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
        name: {
            type:    String,
            trim:    true,
            default: '',
            // e.g. "2024-2025 Main Structure"
        },
        workingDays: {
            type:    [String],
            enum:    ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
            default: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
        },
        periods: {
            type: [periodSchema],
            validate: {
                validator: (v) => v.length > 0,
                message:   'At least one period is required',
            },
        },
        isActive: {
            type:    Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref:  'User',
        },
    },
    { timestamps: true }
);

// One active structure per academic year per semester
timetableStructureSchema.index(
    { academicYear: 1, semester: 1 },
    { unique: true }
);

module.exports = mongoose.model('TimetableStructure', timetableStructureSchema);