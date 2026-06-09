const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    startTime: String,
    endTime: String,
    room: String,
}, { _id: false });

const subjectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Subject name is required'],
            trim: true,
        },
        code: {
            type: String,
            required: [true, 'Subject code is required'],
            uppercase: true,
            trim: true,
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: [true, 'Course reference is required'],
        },
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        credits: {
            type: Number,
            default: 3,
            min: 1,
            max: 10,
        },
        description: {
            type: String,
            default: '',
        },
        schedule: [scheduleSchema],
        semester: {
            type: Number,
            default: false,
        },
    },
    { timestamps: true }
);

subjectSchema.index({ course: 1 });
subjectSchema.index({ code: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);