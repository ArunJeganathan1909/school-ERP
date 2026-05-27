const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: '',
        },
        subject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject',
            required: true,
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
        },
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        totalMarks: {
            type: Number,
            default: 100
        },
        passingMarks: {
            type: Number,
            default: 40,
        },
        attachmentUrl: {
            type: String,
            default: '',
        },
        instruction: {
            type: String,
            default: '',
        },
        allowLateSubmission: {
            type: Boolean,
            default: false,
        },
        isPublished: {
            type: Boolean,
            default: true
        }
    }, { timestamps: true }
);

assignmentSchema.index({ course: 1, dueDate: -1 });
assignmentSchema.index({ subject: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);