const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        subject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject',
            default: null,          // ← not required at schema level
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: [true, 'Course is required'],
        },
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Teacher is required'],
        },
        dueDate: {
            type: Date,
            required: [true, 'Due date is required'],
        },
        totalMarks: {
            type: Number,
            default: 100,
        },
        passingMarks: {
            type: Number,
            default: 40,
        },
        attachmentUrl: {
            type: String,
            default: '',
        },
        instructions: {
            type: String,
            default: '',
        },
        allowLateSubmission: {
            type: Boolean,
            default: false,
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

assignmentSchema.index({ course: 1, dueDate: -1 });
assignmentSchema.index({ subject: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);