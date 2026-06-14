const StudentSection = require('../models/StudentSection');
const Section        = require('../models/Section');
const Grade          = require('../models/Grade');
const AcademicYear   = require('../models/AcademicYear');
const User           = require('../models/User');

// POST /api/student-sections/assign
// Assign a student to a section
exports.assignStudent = async (req, res) => {
    try {
        const { studentId, sectionId, rollNumber } = req.body;

        // Validate student exists and is a student role
        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Validate section exists
        const section = await Section.findById(sectionId)
            .populate('grade', 'gradeNumber name')
            .populate('academicYear', 'name currentSemester');

        if (!section) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        // Check capacity
        const currentCount = await StudentSection.countDocuments({
            section: sectionId,
            status:  'active',
        });
        if (currentCount >= section.capacity) {
            return res.status(400).json({
                success: false,
                message: `Section ${section.grade?.gradeNumber}${section.name} is at full capacity (${section.capacity})`,
            });
        }

        // Check if student already has an active assignment in this academic year
        const existing = await StudentSection.findOne({
            student:      studentId,
            academicYear: section.academicYear._id,
        });

        if (existing) {
            if (existing.status === 'active') {
                return res.status(400).json({
                    success: false,
                    message: 'Student is already assigned to a section this academic year. Transfer instead.',
                });
            }
            // Re-activate if withdrawn
            existing.section    = sectionId;
            existing.grade      = section.grade._id;
            existing.rollNumber = rollNumber || existing.rollNumber;
            existing.status     = 'active';
            existing.joinedAt   = Date.now();
            existing.leftAt     = null;
            await existing.save();

            // Update denormalized fields on User
            await User.findByIdAndUpdate(studentId, {
                $set: {
                    currentGrade:   section.grade?.gradeNumber,
                    currentSection: section.name,
                    rollNumber:     rollNumber || existing.rollNumber,
                },
            });

            await existing.populate([
                { path: 'student',      select: 'name email' },
                { path: 'section',      select: 'name' },
                { path: 'grade',        select: 'name gradeNumber' },
                { path: 'academicYear', select: 'name' },
            ]);

            return res.status(200).json({ success: true, record: existing, message: 'Student re-assigned' });
        }

        const record = await StudentSection.create({
            student:      studentId,
            section:      sectionId,
            grade:        section.grade._id,
            academicYear: section.academicYear._id,
            rollNumber:   rollNumber || '',
            status:       'active',
        });

        // Update denormalized fields on User
        await User.findByIdAndUpdate(studentId, {
            $set: {
                currentGrade:   section.grade?.gradeNumber,
                currentSection: section.name,
                rollNumber:     rollNumber || '',
            },
        });

        await record.populate([
            { path: 'student',      select: 'name email currentGrade currentSection' },
            { path: 'section',      select: 'name' },
            { path: 'grade',        select: 'name gradeNumber' },
            { path: 'academicYear', select: 'name' },
        ]);

        res.status(201).json({ success: true, record });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Student is already assigned to a section this academic year',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/student-sections/transfer
// Transfer student from one section to another
exports.transferStudent = async (req, res) => {
    try {
        const { studentId, newSectionId, transferNote } = req.body;

        // Find current active assignment
        const currentRecord = await StudentSection.findOne({
            student: studentId,
            status:  'active',
        }).populate('section', 'name grade academicYear')
            .populate('grade', 'gradeNumber');

        if (!currentRecord) {
            return res.status(404).json({
                success: false,
                message: 'No active section assignment found for this student',
            });
        }

        // Validate new section
        const newSection = await Section.findById(newSectionId)
            .populate('grade', 'gradeNumber name')
            .populate('academicYear', 'name');

        if (!newSection) {
            return res.status(404).json({ success: false, message: 'Target section not found' });
        }

        // Must be same academic year
        if (String(newSection.academicYear._id) !== String(currentRecord.academicYear)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot transfer to a section in a different academic year',
            });
        }

        // Check capacity
        const count = await StudentSection.countDocuments({ section: newSectionId, status: 'active' });
        if (count >= newSection.capacity) {
            return res.status(400).json({
                success: false,
                message: 'Target section is at full capacity',
            });
        }

        // Mark current as transferred
        currentRecord.status       = 'transferred';
        currentRecord.leftAt       = Date.now();
        currentRecord.transferNote = transferNote || '';
        await currentRecord.save();

        // Create new assignment
        const newRecord = await StudentSection.create({
            student:      studentId,
            section:      newSectionId,
            grade:        newSection.grade._id,
            academicYear: newSection.academicYear._id,
            rollNumber:   '',
            status:       'active',
            promotedFrom: currentRecord._id,
        });

        // Update denormalized User fields
        await User.findByIdAndUpdate(studentId, {
            $set: {
                currentGrade:   newSection.grade?.gradeNumber,
                currentSection: newSection.name,
                rollNumber:     '',
            },
        });

        await newRecord.populate([
            { path: 'student',      select: 'name email' },
            { path: 'section',      select: 'name' },
            { path: 'grade',        select: 'name gradeNumber' },
            { path: 'academicYear', select: 'name' },
        ]);

        res.status(200).json({
            success: true,
            record:  newRecord,
            message: `Student transferred to ${newSection.grade?.gradeNumber}${newSection.name}`,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/student-sections/:id/withdraw
exports.withdrawStudent = async (req, res) => {
    try {
        const record = await StudentSection.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    status:       'withdrawn',
                    leftAt:       Date.now(),
                    transferNote: req.body.reason || '',
                },
            },
            { new: true }
        ).populate('student', 'name email');

        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        // Clear denormalized fields on User
        await User.findByIdAndUpdate(record.student._id, {
            $set: { currentGrade: null, currentSection: null, rollNumber: '' },
        });

        res.status(200).json({ success: true, record, message: 'Student withdrawn' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/student-sections/:id/roll-number
exports.updateRollNumber = async (req, res) => {
    try {
        const { rollNumber } = req.body;

        const record = await StudentSection.findByIdAndUpdate(
            req.params.id,
            { $set: { rollNumber } },
            { new: true }
        ).populate('student', 'name email');

        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        // Sync to User
        await User.findByIdAndUpdate(record.student._id, { $set: { rollNumber } });

        res.status(200).json({ success: true, record });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/student-sections/my — student's own section history
exports.getMyHistory = async (req, res) => {
    try {
        const records = await StudentSection.find({ student: req.user._id })
            .populate('section',      'name room capacity')
            .populate('grade',        'name gradeNumber stream')
            .populate('academicYear', 'name currentSemester totalSemesters')
            .sort({ joinedAt: -1 });

        res.status(200).json({ success: true, records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/student-sections/my/current — student's current active section
exports.getMyCurrent = async (req, res) => {
    try {
        const record = await StudentSection.findOne({
            student: req.user._id,
            status:  'active',
        })
            .populate({
                path:     'section',
                select:   'name room capacity currentSemester classTeacher',
                populate: { path: 'classTeacher', select: 'name email phone profilePhoto' },
            })
            .populate('grade',        'name gradeNumber stream')
            .populate('academicYear', 'name currentSemester totalSemesters semesterDates');

        if (!record) {
            return res.status(200).json({ success: true, record: null, message: 'Not assigned to any section' });
        }

        // Get classmates
        const classmates = await StudentSection.find({
            section: record.section._id,
            status:  'active',
            student: { $ne: req.user._id },
        })
            .populate('student', 'name email profilePhoto rollNumber')
            .sort({ rollNumber: 1 })
            .limit(50);

        res.status(200).json({ success: true, record, classmates });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/student-sections?section=id&academicYear=id — admin
exports.getAll = async (req, res) => {
    try {
        const { section, grade, academicYear, status, student } = req.query;
        const filter = {};
        if (section)      filter.section      = section;
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (status)       filter.status       = status;
        if (student)      filter.student      = student;

        const records = await StudentSection.find(filter)
            .populate('student',      'name email phone profilePhoto admissionNumber')
            .populate('section',      'name')
            .populate('grade',        'name gradeNumber')
            .populate('academicYear', 'name')
            .sort({ rollNumber: 1 });

        res.status(200).json({ success: true, records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/student-sections/promote
// Promote all active students in a section to a new grade/section for next year
exports.promoteStudents = async (req, res) => {
    try {
        const { fromSectionId, toSectionId, academicYearId } = req.body;

        const activeStudents = await StudentSection.find({
            section: fromSectionId,
            status:  'active',
        });

        if (activeStudents.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No active students found in the source section',
            });
        }

        const toSection = await Section.findById(toSectionId)
            .populate('grade', 'gradeNumber name');

        if (!toSection) {
            return res.status(404).json({ success: false, message: 'Target section not found' });
        }

        const results = { promoted: 0, failed: 0, errors: [] };

        for (const record of activeStudents) {
            try {
                // Mark old record as completed
                record.status = 'completed';
                record.leftAt = Date.now();
                await record.save();

                // Create new record for next year
                await StudentSection.create({
                    student:      record.student,
                    section:      toSectionId,
                    grade:        toSection.grade._id,
                    academicYear: academicYearId,
                    rollNumber:   '',
                    status:       'active',
                    promotedFrom: record._id,
                });

                // Update denormalized user
                await User.findByIdAndUpdate(record.student, {
                    $set: {
                        currentGrade:   toSection.grade?.gradeNumber,
                        currentSection: toSection.name,
                        rollNumber:     '',
                    },
                });

                results.promoted++;
            } catch (e) {
                results.failed++;
                results.errors.push({ student: record.student, error: e.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Promoted ${results.promoted} students. ${results.failed} failed.`,
            results,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};