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
            required: [true, 'Subject is required'],   // ← now required, course removed
        },
        // Optional — set only when the teacher pins this assignment to one
        // specific section they teach (via SubjectTeacherAssignment). Leaving
        // it null means it applies to every section the teacher teaches for
        // this subject.
        section: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Section',
            default: null,
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

assignmentSchema.index({ subject: 1, dueDate: -1 });
assignmentSchema.index({ section: 1 });
assignmentSchema.index({ teacher: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);