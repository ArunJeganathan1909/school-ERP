const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type:     String,
            required: [true, 'Name is required'],
            trim:     true,
        },
        email: {
            type:      String,
            required:  [true, 'Email is required'],
            unique:    true,
            lowercase: true,
            trim:      true,
        },
        password: {
            type:      String,
            required:  [true, 'Password is required'],
            minlength: 6,
            select:    false,
        },
        role: {
            type:    String,
            enum:    ['student', 'teacher', 'admin'],
            default: 'student',
        },
        isActive: {
            type:    Boolean,
            default: true,
        },
        profilePhoto: {
            type:    String,
            default: '',
        },
        phone: {
            type:    String,
            default: '',
        },

        // ── Student-specific fields ──────────────────────────────────────────────
        // Denormalised for quick display — source of truth is StudentSection
        currentGrade: {
            type:    Number,
            default: null,
            // e.g. 7 for Grade 7
        },
        currentSection: {
            type:    String,
            default: null,
            // e.g. "A" (section name)
        },
        rollNumber: {
            type:    String,
            default: '',
            // e.g. "7A-001" — denormalised from StudentSection
        },
        admissionNumber: {
            type:    String,
            default: '',
            unique:  false,
            sparse:  true,
            // School admission number e.g. "ADM-2024-001"
        },
        admissionYear: {
            type:    Number,
            default: null,
        },
        dateOfBirth: {
            type:    Date,
            default: null,
        },
        gender: {
            type:    String,
            enum:    ['male', 'female', 'other', ''],
            default: '',
        },
        guardianName: {
            type:    String,
            default: '',
        },
        guardianPhone: {
            type:    String,
            default: '',
        },
        address: {
            type:    String,
            default: '',
        },

        // ── Teacher-specific fields ──────────────────────────────────────────────
        qualification: {
            type:    String,
            default: '',
        },
        specialization: {
            type:    String,
            default: '',
        },
        employeeId: {
            type:    String,
            default: '',
        },
    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);