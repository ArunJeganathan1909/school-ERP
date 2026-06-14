const mongoose = require('mongoose');

const studentSectionSchema = new mongoose.Schema(
    {
        student: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'User',
            required: [true, 'Student is required'],
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
        rollNumber: {
            type:    String,
            trim:    true,
            default: '',
            // e.g. "7A-001"
        },
        status: {
            type:    String,
            enum:    ['active', 'transferred', 'withdrawn', 'completed'],
            default: 'active',
        },
        joinedAt: {
            type:    Date,
            default: Date.now,
        },
        leftAt: {
            type:    Date,
            default: null,
        },
        transferNote: {
            type:    String,
            default: '',
        },
        promotedFrom: {
            // Reference to previous year's StudentSection
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'StudentSection',
            default: null,
        },
    },
    { timestamps: true }
);

// A student can only be in ONE active section per academic year
studentSectionSchema.index({ student: 1, academicYear: 1 }, { unique: true });
studentSectionSchema.index({ section: 1, status: 1 });
studentSectionSchema.index({ grade: 1, academicYear: 1 });
studentSectionSchema.index({ rollNumber: 1, section: 1 });

module.exports = mongoose.model('StudentSection', studentSectionSchema);