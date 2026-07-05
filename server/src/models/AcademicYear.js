const mongoose = require('mongoose');

const semesterDateSchema = new mongoose.Schema(
    {
        semester:  { type: Number, required: true },
        startDate: { type: Date,   required: true },
        endDate:   { type: Date,   required: true },
        label:     { type: String, default: '' },  // e.g. "Term 1", "First Semester"
    },
    { _id: false }
);

const academicYearSchema = new mongoose.Schema(
    {
        name: {
            type:     String,
            required: [true, 'Academic year name is required'],
            unique:   true,
            trim:     true,
            // e.g. "2024-2025"
        },
        startDate: {
            type:     Date,
            required: [true, 'Start date is required'],
        },
        endDate: {
            type:     Date,
            required: [true, 'End date is required'],
        },
        totalSemesters: {
            type:    Number,
            default: 3,
            min:     1,
            max:     4,
        },
        currentSemester: {
            type:    Number,
            default: 1,
            min:     1,
        },
        semesterDates: [semesterDateSchema],
        isActive: {
            type:    Boolean,
            default: false,
            // Only ONE academic year should be active at a time
            // enforced at controller level
        },
        description: {
            type:    String,
            default: '',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref:  'User',
        },
    },
    { timestamps: true }
);

academicYearSchema.index({ isActive: 1 });
academicYearSchema.index({ name: 1 });

module.exports = mongoose.model('AcademicYear', academicYearSchema);