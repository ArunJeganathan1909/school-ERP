const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema(
    {
        academicYear: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'AcademicYear',
            required: [true, 'Academic year is required'],
        },
        gradeNumber: {
            type:     Number,
            required: [true, 'Grade number is required'],
            min:      1,
            max:      13,
            // 1=Grade 1, 5=Grade 5, 6=Grade 6 ... 11=Grade 11
        },
        name: {
            type:     String,
            required: [true, 'Grade name is required'],
            trim:     true,
            // e.g. "Grade 7", "Year 7", "Form 2"
        },
        stream: {
            type:    String,
            enum:    ['general', 'science', 'arts', 'commerce', 'technology', 'none'],
            default: 'none',
            // Used for O/L & A/L streams
        },
        description: {
            type:    String,
            default: '',
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

// One grade number per stream per academic year
gradeSchema.index({ academicYear: 1, gradeNumber: 1, stream: 1 }, { unique: true });
gradeSchema.index({ academicYear: 1 });
gradeSchema.index({ gradeNumber: 1 });

module.exports = mongoose.model('Grade', gradeSchema);