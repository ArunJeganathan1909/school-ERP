const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
    { text: { type: String, required: true }, isCorrect: { type: Boolean, default: false } },
    { _id: true }
);

const questionSchema = new mongoose.Schema(
    {
        questionText: { type: String, required: true },
        type: { type: String, enum: ['mcq', 'true_false', 'short'], default: 'mcq' },
        options: [optionSchema],          // for mcq / true_false
        correctAnswer: { type: String, default: '' }, // for short answer
        marks: { type: Number, default: 1 },
        explanation: { type: String, default: '' },
    },
    { _id: true }
);

const attemptSchema = new mongoose.Schema(
    {
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        answers: [
            {
                question: mongoose.Schema.Types.ObjectId,
                selectedOption: mongoose.Schema.Types.ObjectId,
                textAnswer: String,
                isCorrect: Boolean,
                marksAwarded: Number,
            },
        ],
        score: { type: Number, default: 0 },
        totalMarks: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
        startedAt: { type: Date, default: Date.now },
        submittedAt: { type: Date, default: null },
        timeTaken: { type: Number, default: 0 }, // seconds
    },
    { _id: true, timestamps: true }
);

const quizSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
        teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        instructions: { type: String, default: '' },
        duration: { type: Number, default: 30 },   // minutes
        totalMarks: { type: Number, default: 0 },
        passingPercentage: { type: Number, default: 50 },
        maxAttempts: { type: Number, default: 1 },
        shuffleQuestions: { type: Boolean, default: false },
        showResults: { type: Boolean, default: true },
        isPublished: { type: Boolean, default: false },
        questions: [questionSchema],
        attempts: [attemptSchema],
        availableFrom: { type: Date, default: null },
        availableUntil: { type: Date, default: null },
    },
    { timestamps: true }
);

quizSchema.index({ course: 1 });
quizSchema.index({ subject: 1 });

module.exports = mongoose.model('Quiz', quizSchema);