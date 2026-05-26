const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'dropped', 'completed', 'pending'],
            default: 'active',
        },
        enrolledAt: {
            type: Date,
            default: Date.now,
        },
        completedAt: {
            type: Date,
            default: null,
        }        ,
        grade: {
            type: String,
            enum: ['A+','A','B+','B','C+','C','D','F', null],
            default: null,
        },
        gradePoints: {
            type: Number,
            default: null,
        },
        remarks: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

// Prevent duplicate enrollment
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ student: 1, status: 1 });
enrollmentSchema.index({ course: 1, status: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);