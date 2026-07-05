const Fee = require('../models/Fee');
const Section = require('../models/Section');
const StudentSection = require('../models/StudentSection');
const { notify } = require('../socket/socketHelpers');

const FEE_POPULATE = [
    { path: 'student', select: 'name email profilePhoto' },
    { path: 'section', select: 'name grade academicYear', populate: { path: 'grade', select: 'name gradeNumber' } },
    { path: 'academicYear', select: 'name' },
];

// GET /api/fees - admin: all fees with filters
exports.getAllFees = async (req, res) => {
    try {
        const { student, section, grade, academicYear, semester, status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (student)      filter.student      = student;
        if (section)      filter.section      = section;
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);
        if (status && status.trim())       filter.status       = status;   // ← only add if non-empty

        const skip = (Number(page) - 1) * Number(limit);

        const [fees, total] = await Promise.all([
            Fee.find(filter)
                .populate(FEE_POPULATE)
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
            .populate(FEE_POPULATE)
            .sort({ dueDate: 1 });

        const totalDue = fees
            .filter((f) => ['pending', 'partial', 'overdue'].includes(f.status))
            .reduce((sum, f) => sum + (f.netAmount- f.paidAmount), 0);

        res.status(200).json({
            success: true,
            fees,
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
            .populate({ path: 'section', select: 'name grade academicYear', populate: { path: 'grade', select: 'name gradeNumber' } })
            .populate('academicYear', 'name')
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

// POST /api/fees - admin creates a single ad-hoc fee invoice for one student.
// If `section` isn't passed explicitly, it's derived from the student's
// current active StudentSection.
exports.createFee = async (req, res) => {
    try {
        const { student, feeType, title, totalAmount, discount, dueDate, semester } = req.body;
        let { section } = req.body;

        if (!student) {
            return res.status(400).json({ success: false, message: 'Student is required' });
        }

        let sectionDoc;
        if (section) {
            sectionDoc = await Section.findById(section);
        } else {
            const studentSection = await StudentSection.findOne({ student, status: 'active' });
            if (!studentSection) {
                return res.status(400).json({
                    success: false,
                    message: 'This student has no active section — assign one first, or pass a section explicitly.',
                });
            }
            section = studentSection.section;
            sectionDoc = await Section.findById(section);
        }

        if (!sectionDoc) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        const fee = await Fee.create({
            student,
            section: sectionDoc._id,
            grade: sectionDoc.grade,
            academicYear: sectionDoc.academicYear,
            feeType,
            title,
            totalAmount,
            discount: discount || 0,
            dueDate,
            semester: semester || sectionDoc.currentSemester || 1,
        });

        await fee.populate(FEE_POPULATE);
        res.status(201).json({
            success: true,
            fee
        })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'This student already has an identical fee invoice for this term.',
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// POST /api/fees/bulk-section — admin: generate the same recurring fee
// invoice for every active student in a section (e.g. "Semester 2 tuition"
// for Grade 7A). This is the normal way to bill a whole class each term.
exports.bulkCreateFeesForSection = async (req, res) => {
    try {
        const { section, feeType, title, totalAmount, discount, dueDate, semester } = req.body;

        if (!section) {
            return res.status(400).json({ success: false, message: 'Section is required' });
        }

        const sectionDoc = await Section.findById(section);
        if (!sectionDoc) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        const studentSections = await StudentSection.find({ section, status: 'active' });
        if (studentSections.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No active students found in this section.',
            });
        }

        const resolvedSemester = semester || sectionDoc.currentSemester || 1;

        const feeData = studentSections.map((ss) => ({
            student: ss.student,
            section: sectionDoc._id,
            grade: sectionDoc.grade,
            academicYear: sectionDoc.academicYear,
            feeType,
            title,
            totalAmount,
            discount: discount || 0,
            dueDate,
            semester: resolvedSemester,
        }));

        const result = await Fee.insertMany(feeData, { ordered: false });

        res.status(201).json({
            success: true,
            message: `${result.length} of ${feeData.length} fee invoices created`,
            count: result.length,
            expected: feeData.length,
        });
    } catch (error) {
        // Some students in the section may already have this exact invoice
        // (duplicate key on student+section+academicYear+semester+title) —
        // that's expected when re-running for stragglers, not a hard failure.
        if (error.code === 11000 || error.writeErrors) {
            const inserted = error.insertedDocs?.length ?? error.result?.nInserted ?? 0;
            return res.status(207).json({
                success: true,
                message: `${inserted} fee invoice(s) created. Some students already had this invoice for this term.`,
                count: inserted,
            });
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
        await fee.populate(FEE_POPULATE);

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
        await fee.populate(FEE_POPULATE);

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