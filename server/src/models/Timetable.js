const mongoose = require('mongoose');

// A single slot in the timetable grid
const slotSchema = new mongoose.Schema(
    {
        period: {
            type: Number,
            required: true, // 1-based (Period 1, Period 2, ...)
        },
        day: {
            type: String,
            required: true,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
        subject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject',
            default: null, // null means free / unassigned
        },
        // Denormalised for quick reads without extra populate
        label: {
            type: String,
            default: '', // e.g. "Lunch Break", "Assembly" for non-subject slots
        },
        isBreak: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
);

// One period definition (its position + time window)
const periodSchema = new mongoose.Schema(
    {
        number: { type: Number, required: true },   // 1, 2, 3 …
        startTime: { type: String, required: true }, // "08:00"
        endTime:   { type: String, required: true }, // "08:40"
        label:     { type: String, default: '' },    // optional override name e.g. "Lunch"
        isBreak:   { type: Boolean, default: false },
    },
    { _id: false }
);

const timetableSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: [true, 'Course is required'],
        },
        // Academic year / term label, e.g. "2024-2025 Semester 1"
        term: {
            type: String,
            required: [true, 'Term label is required'],
            trim: true,
        },
        // Which days are active for this timetable
        workingDays: {
            type: [String],
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
        // Period definitions (ordered by number)
        periods: {
            type: [periodSchema],
            validate: {
                validator: (v) => v.length > 0,
                message: 'At least one period is required',
            },
        },
        // The actual grid: one entry per (day × period)
        slots: [slotSchema],

        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// Only one active timetable per course+term combination
timetableSchema.index({ course: 1, term: 1 }, { unique: true });
timetableSchema.index({ course: 1, isActive: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);