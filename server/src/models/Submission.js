const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
    {
        assignment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Assignment',
            required: true
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',          // ← was 'Student'; User is the correct registered model
            required: true
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true
        },
        fileUrl: {
            type: String,
            default: ''
        },
        textAnswer: {
            type: String,
            default: ''
        },
        submittedAt: {
            type: Date,
            default: Date.now
        },
        isLate: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ['submitted', 'graded', 'returned'],
            default: 'submitted',
        },
        marks: {
            type: Number,
            default: null
        },
        feedback: {
            type: String,
            default: ''
        },
        gradedAt: {
            type: Date,
            default: null
        },
        gradedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
    }, { timestamps: true }
);

// One submission per student per assignment
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ course: 1, student: 1 });

module.exports = mongoose.model('Submission', submissionSchema);