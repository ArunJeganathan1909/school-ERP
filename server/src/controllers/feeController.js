const Fee = require('../models/Fee');
const { notify } = require('../socket/socketHelpers');

// GET /api/fees - admin: all fees with filters
exports.getAllFees = async (req, res) => {
    try {
        const { student, course, status, academicYear, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (student)      filter.student      = student;
        if (course)       filter.course       = course;
        if (status && status.trim())       filter.status       = status;   // ← only add if non-empty
        if (academicYear) filter.academicYear = academicYear;

        const skip = (Number(page) - 1) * Number(limit);

        const [fees, total] = await Promise.all([
            Fee.find(filter)
                .populate('student', 'name email profilePhoto')
                .populate('course',  'title code')
                .skip(skip)
                .limit(Number(limit))
                .sort({ dueDate: 1 }),
            Fee.countDocuments(filter),
        ]);

        // Summary stats
        const stats = await Fee.aggregate([
            { $match: filter },
            {
                $group: {
                    _id:            null,
                    totalExpected:  { $sum: '$netAmount'  },
                    totalCollected: { $sum: '$paidAmount' },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                    overdue:  { $sum: { $cond: [{ $eq: ['$status', 'overdue']  }, 1, 0] } },
                    paid:     { $sum: { $cond: [{ $eq: ['$status', 'paid']     }, 1, 0] } },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            total,
            page:  Number(page),
            pages: Math.ceil(total / Number(limit)),
            fees,
            stats: stats[0] || {
                totalExpected:  0,
                totalCollected: 0,
                pending:        0,
                overdue:        0,
                paid:           0,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/fees/my - student: own fees
exports.getMyFees = async (req, res) => {
    try {
        const { status }  = req.query;
        const filter = { student: req.user._id };
        if (status) filter.status = status;

        const fees = await Fee.find(filter)
            .populate('course', 'title code')
            .sort({ dueDate: 1 });

        const totalDue = fees
            .filter((f) => ['pending', 'partial', 'overdue'].includes(f.status))
            .reduce((sum, f) => sum + (f.netAmount- f.paidAmount), 0);

        res.status(200).json({
            success: true,
            totalDue
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// GET /api/fees/:id
exports.getFee = async (req, res) => {
    try {
        const fee = await Fee.findById(req.params.id)
            .populate('student', 'name email phone')
            .populate('course', 'title code')
            .populate('payments.recordedBy', 'name');

        if (!fee) res.status(404).json({
            success: false,
            message: 'Fee not found',
        });

    //     Students can only view own fees
        if (req.user.role === 'student' && String(fee.student._id) !== String(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            });
        }

        res.status(200).json({
            success: true,
            fee
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// POST /api/fees - admin creates a fee invoice
exports.createFee = async (req, res) => {
    try {
        const fee = await Fee.create(req.body);
        await fee.populate([
            { path: 'student', select: 'name email' },
            { path: 'course', select: 'title code' },
        ]);
        res.status(201).json({
            success: true,
            fee
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// POST /api/fees/bulk — admin: create same fee for multiple students
exports.bulkCreateFees = async (req, res) => {
    try {
        const { studentIds, courseId, feeType, title, totalAmount, discount, dueDate, academicYear, semester } = req.body;

        const feeData = studentIds.map((studentId) => ({
            student: studentId,
            course: courseId,
            feeType,
            title,
            totalAmount,
            discount: discount || 0,
            dueDate,
            academicYear,
            semester,
        }));

        const fees = await Fee.insertMany(feeData, { ordered: false });

        res.status(201).json({
            success: true,
            message: `${fees.length} fee records created`,
            count: fees.length,
        });
    } catch (error) {
    //     Handle duplicate key errors gracefully
        if (error.code === 11000) {
            return res.status(207).json({
                success: true,
                message: 'Some records may already exist',
                error: error.message,
            })
        }
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// PUT /api/fees/:id — admin: update fee details
exports.updateFee = async (req, res) => {
    try {
        const fee = await Fee.findById(req.params.id);
        if (!fee) return res.status(404).json({
            success: false,
            message: 'Fee not found',
        })

        Object.assign(fee, req.body);
        await fee.save();  // triggers pre-save recalculation

        res.status(200).json({
            success: true,
            fee
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// POST /api/fees/:id/payment — admin records a payment
exports.recordPayment = async (req, res) => {
    try {
        const { amount, method, reference } = req.body;

        const fee = await Fee.findById(req.params.id);
        if (!fee) return res.status(404).json({ success: false, message: 'Fee not found' });

        // Validate amount
        const remaining = fee.netAmount - fee.paidAmount;
        if (Number(amount) > remaining) {
            return res.status(400).json({
                success: false,
                message: `Payment of ${amount} exceeds remaining balance of ${remaining}`,
            });
        }

        // Push payment into array
        fee.payments.push({
            amount: Number(amount),
            method: method || 'cash',
            reference: reference || '',
            recordedBy: req.user._id,
            paidAt: new Date(),
        });

        // .save() triggers pre-save hook which recalculates paidAmount and status
        await fee.save();

        // Populate and return
        await fee.populate([
            { path: 'student', select: 'name email' },
            { path: 'course',  select: 'title code' },
        ]);

        res.status(200).json({ success: true, fee });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/fees/:id — admin only
exports.deleteFee = async (req, res) => {
    try {
        const fee = await Fee.findById(req.params.id);
        if (!fee) return res.status(404).json({
            success: false,
            message: 'Fee not found',
        });
        if (fee.paidAmount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete a fee with recorded payments'
            })
        }
        await fee.deleteOne();
        res.status(200).json({
            success: true,
            message: 'Fee deleted',
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}