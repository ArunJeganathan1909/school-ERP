const mongoose = require('mongoose');

/**
 * SubjectTeacherAssignment
 * ─────────────────────────────────────────────────────────────────────────────
 * Join table mapping ONE Subject to MANY (Section → Teacher) pairs.
 *
 * Example: Subject "Mathematics" (gradeRange: "6-9") can have:
 *   { subject: Mathematics, section: Grade9A, teacher: Teacher1 }
 *   { subject: Mathematics, section: Grade9B, teacher: Teacher2 }
 *   { subject: Mathematics, section: Grade7A, teacher: Teacher3 }
 *
 * A section can only have ONE teacher per subject (enforced by unique index).
 * A teacher can teach the same subject in multiple sections, and different
 * subjects in the same section — no restriction there.
 */
const subjectTeacherAssignmentSchema = new mongoose.Schema(
    {
        subject: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'Subject',
            required: [true, 'Subject is required'],
        },
        section: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'Section',
            required: [true, 'Section is required'],
        },
        teacher: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'User',
            required: [true, 'Teacher is required'],
        },
        // Denormalised for quick filtering without populating section→grade
        grade: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Grade',
            default: null,
        },
        isActive: {
            type:    Boolean,
            default: true,
        },
        assignedBy: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'User',
            default: null,
        },
    },
    { timestamps: true }
);

// One teacher per subject per section — only one active assignment at a time
subjectTeacherAssignmentSchema.index({ subject: 1, section: 1 }, { unique: true });
subjectTeacherAssignmentSchema.index({ teacher: 1 });
subjectTeacherAssignmentSchema.index({ section: 1 });
subjectTeacherAssignmentSchema.index({ grade: 1 });

module.exports = mongoose.model('SubjectTeacherAssignment', subjectTeacherAssignmentSchema);