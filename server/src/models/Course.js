const mongoose = require('mongoose')

const courseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Course title is required'],
        trim: true,
    },
    code: {
        type: String,
        required: [true, 'Course code is required'],
        unique: true,
        uppercase: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
    },
    department: {
        type: String,
        required: [true, 'Department is required'],
        trim: true,
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    duration: {
        type: String,
        default: '',
    },
    maxStudents: {
        type: Number,
        default: 60,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'archived'],
        default: 'active',
    },
    thumbnail: {
        type: String,
        default: '',
    },
    tags: [{ type: String }],
},
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual: enrolled student count
courseSchema.virtual('enrolledCount', {
    ref: 'Enrollment',
    localField: '_id',
    foreignField: 'course',
    count: true,
});

// Indexes for fast lookup
courseSchema.index({ code: 1 });
courseSchema.index({ department: 1 });
courseSchema.index({ status: 1 });

module.exports = mongoose.model('Course', courseSchema);