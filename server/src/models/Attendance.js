const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        subject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject',
            required: true
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true
        },
        markedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ['present', 'absent', 'late', 'excused'],
            default: 'present'
        },
        remarks: {
            type: String,
            default: ''
        },
        sessionType: {
            type: String,
            enum: ['lecture', 'lab', 'tutorial', 'exam'],
            default: 'lecture',
        },
    }, { timestamps: true }
);

// One record per student per subject per date
attendanceSchema.index({ student: 1, subject: 1, date: 1 }, { unique: true });
attendanceSchema.index({ subject: 1, date: 1 });
attendanceSchema.index({ course: 1, date: 1 });
attendanceSchema.index({ student: 1, course: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);