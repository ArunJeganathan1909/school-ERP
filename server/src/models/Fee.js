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
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true
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
        academicYear: {
            type: String,
            default: () => {
                const y = new Date().getFullYear();
                return `${y}-${y+1}`;
            },
        },
        semester: {
            type: Number,
            default: 1
        },
        notes: {
            type: String,
            default: '',
        },
    }, { timestamps: true }
);

// Auto-calculate netAmount before saving
feeSchema.pre('save', function (next) {
    this.netAmount = this.totalAmount - (this.discount || 0);

    // Auto-update status
    if (this.status !== 'waived') {
        if (this.paidAmount <= 0){
            this.status = new Date() > new Date(this.dueDate) ? 'overdue' : 'pending';
        } else if (this.paidAmount >= this.netAmount){
            this.status = 'paid';
        } else {
            this.status = 'partial';
        }
    }

    next();
});

feeSchema.index({ student: 1, status: 1 });
feeSchema.index({ course: 1, academicYear: 1 });
feeSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Fee', feeSchema);