const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        content: {
            type: String,
            required: true,
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        audience: {
            type: String,
            enum: ['all', 'student', 'teacher', 'admin'],
            default: 'all',
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            default: null
        },
        isPinned: {
            type: Boolean,
            default: false
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        expiresAt: {
            type: Date,
            default: null
        },
        attachmentUrl: {
            type: String,
            default: ''
        },
    }, { timestamps: true }
);

announcementSchema.index({ audience: 1, isPublished: 1, createdAt: -1 });
announcementSchema.index({ isPinned: 1, createdAt: -1 });
announcementSchema.index({ course: 1 });

module.exports = mongoose.model('Announcement', announcementSchema); 