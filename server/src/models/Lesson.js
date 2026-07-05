const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
    {
        title: {
            type:     String,
            required: true,
            trim:     true,
        },
        subject: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'Subject',
            required: [true, 'Subject is required'],
        },
        // Which section this lesson is for (optional — a lesson can be section-specific
        // or shared across sections teaching the same subject)
        section: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Section',
            default: null,
        },
        teacher: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'User',
            required: true,
        },
        type: {
            type:    String,
            enum:    ['text', 'video', 'pdf', 'link', 'slide'],
            default: 'text',
        },
        content: {
            type:    String,
            default: '',
        },
        fileUrl: {
            type:    String,
            default: '',
        },
        externalUrl: {
            type:    String,
            default: '',
        },
        order: {
            type:    Number,
            default: 0,
        },
        isPublished: {
            type:    Boolean,
            default: false,
        },
        duration: {
            // in minutes
            type:    Number,
            default: 0,
        },
        tags: [String],
    },
    { timestamps: true }
);

lessonSchema.index({ subject: 1, order: 1 });
lessonSchema.index({ section: 1 });
lessonSchema.index({ teacher: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);