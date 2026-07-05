const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
    {
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
        name: {
            type:     String,
            required: [true, 'Section name is required'],
            trim:     true,
            uppercase: true,
            // e.g. "A", "B", "C"
        },
        classTeacher: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'User',
            default: null,
        },
        capacity: {
            type:    Number,
            default: 40,
            min:     1,
        },
        currentSemester: {
            type:    Number,
            default: 1,
            min:     1,
            max:     4,
        },
        room: {
            type:    String,
            default: '',
            // Home room / classroom
        },
        isActive: {
            type:    Boolean,
            default: true,
        },
        description: {
            type:    String,
            default: '',
        },
    },
    {
        timestamps: true,
        toJSON:   { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual: display name e.g. "7A"
sectionSchema.virtual('displayName').get(function () {
    // Will be populated after grade populate
    return this._displayName || this.name;
});

// Virtual: student count
sectionSchema.virtual('studentCount', {
    ref:          'StudentSection',
    localField:   '_id',
    foreignField: 'section',
    count:        true,
    match:        { status: 'active' },
});

// One section name per grade per academic year
sectionSchema.index({ grade: 1, academicYear: 1, name: 1 }, { unique: true });
sectionSchema.index({ academicYear: 1 });
sectionSchema.index({ classTeacher: 1 });

module.exports = mongoose.model('Section', sectionSchema);