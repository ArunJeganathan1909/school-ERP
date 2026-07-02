const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true,
        },
        paidAt: {
            type: Date,
            default: Date.now,
        },
        method: {
            type: String,
            enum: ['cash', 'bank_transfer', 'online', 'cheque'],
            default: 'cash'
        },
        reference: {
            type: String,
            default: '',
        },
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
    }, { _id: true }
);

const feeSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        // A fee invoice belongs to the student's class section for a given
        // term (tuition, exam, etc. are billed per section/grade, not per
        // subject). grade + academicYear are denormalized from the Section
        // at creation time — same pattern as SubjectEnrollment — so fees can
        // be filtered/reported on without populating through Section.
        section: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Section',
            required: [true, 'Section is required'],
        },
        grade: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Grade',
            required: [true, 'Grade is required'],
        },
        academicYear: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AcademicYear',
            required: [true, 'Academic year is required'],
        },
        semester: {
            type: Number,
            default: 1,
            min: 1,
            max: 4,
        },
        feeType: {
            type: String,
            enum: ['tuition', 'exam', 'library', 'lab', 'transport', 'hostel', 'other'],
            default: 'tuition'
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },
        discount: {
            type: Number,
            default: 0,
            min: 0
        },
        netAmount: {
            type: Number,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'partial', 'paid', 'overdue', 'waived'],
            default: 'pending'
        },
        payments: [paymentSchema],
        paidAmount: {
            type: Number,
            default: 0
        },
        notes: {
            type: String,
            default: '',
        },
    }, { timestamps: true }
);

// Auto-calculate netAmount before saving
feeSchema.pre('save', async function () {
    // Step 1: always recalculate netAmount
    this.netAmount = this.totalAmount - (this.discount || 0);

    // Step 2: always recalculate paidAmount from payments array
    this.paidAmount = this.payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Step 3: auto-update status based on recalculated values
    if (this.status !== 'waived') {
        if (this.paidAmount <= 0) {
            this.status = new Date() > new Date(this.dueDate) ? 'overdue' : 'pending';
        } else if (this.paidAmount >= this.netAmount) {
            this.status = 'paid';
        } else {
            this.status = 'partial';
        }
    }
});

feeSchema.index({ student: 1, status: 1 });
feeSchema.index({ section: 1, academicYear: 1, semester: 1 });
feeSchema.index({ grade: 1, academicYear: 1 });
feeSchema.index({ dueDate: 1, status: 1 });

// Guards against accidentally generating the exact same recurring invoice
// (same title) for the same student/section/term twice — e.g. re-running
// the "generate for section" action for the same semester by mistake.
feeSchema.index(
    { student: 1, section: 1, academicYear: 1, semester: 1, title: 1 },
    { unique: true }
);

module.exports = mongoose.model('Fee', feeSchema);