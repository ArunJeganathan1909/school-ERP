const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
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
        type: {
            type: String,
            enum: ['text', 'video', 'pdf', 'link', 'slide'],
            default: 'text',
        },
        content: {
            type: String,
            default: '',
        },
        fileUrl: {
            type: String,
            default: '',
        },
        externalUrl: {
            type: String,
            default: '',
        },
        order: {
            type: Number,
            default: 0,
        },
        isPublished: {
            type: Boolean,
            default: false,
        },
        duration: {
            type: Number,
            default: 0,
        },
        tags: [String],
    },{ timestamps: true }
);

lessonSchema.index({ subject: 1, order: 1 });
lessonSchema.index({ course: 1 });
// lessonSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Lesson', lessonSchema);