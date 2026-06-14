const Timetable      = require('../models/Timetable');
const StudentSection = require('../models/StudentSection');
const Subject        = require('../models/Subject');
const Section        = require('../models/Section');

// ── helpers ──────────────────────────────────────────────────────────────────

const populateTimetable = (query) =>
    query
        .populate('section',      'name room')
        .populate('grade',        'name gradeNumber stream')
        .populate('academicYear', 'name currentSemester')
        .populate('course',       'title code')
        .populate('createdBy',    'name email')
        .populate({
            path:     'slots.subject',
            select:   'name code teacher credits',
            populate: { path: 'teacher', select: 'name email' },
        });

// ── admin: create timetable for a section ────────────────────────────────────

// POST /api/timetables
exports.createTimetable = async (req, res) => {
    try {
        const {
            section, grade, academicYear, semester,
            term, workingDays, periods,
            course,   // for legacy course-based
        } = req.body;

        // Validate period numbers unique
        const nums = periods.map((p) => p.number);
        if (new Set(nums).size !== nums.length) {
            return res.status(400).json({ success: false, message: 'Period numbers must be unique' });
        }

        const days = workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday'];

        // Build empty slot grid
        const slots = [];
        for (const day of days) {
            for (const period of periods) {
                slots.push({
                    day,
                    period:  period.number,
                    subject: null,
                    label:   period.isBreak ? (period.label || 'Break') : '',
                    isBreak: !!period.isBreak,
                });
            }
        }

        const timetable = await Timetable.create({
            section:      section      || null,
            grade:        grade        || null,
            academicYear: academicYear || null,
            semester:     semester     || 1,
            course:       course       || null,
            term,
            workingDays: days,
            periods,
            slots,
            createdBy: req.user._id,
        });

        const populated = await populateTimetable(Timetable.findById(timetable._id));
        res.status(201).json({ success: true, timetable: populated });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A timetable already exists for this section and semester',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/timetables/:id/slots
// Assign or clear a subject in a slot
exports.updateSlot = async (req, res) => {
    try {
        const { day, period, subjectId } = req.body;

        const timetable = await Timetable.findById(req.params.id);
        if (!timetable) {
            return res.status(404).json({ success: false, message: 'Timetable not found' });
        }

        if (!timetable.workingDays.includes(day)) {
            return res.status(400).json({
                success: false,
                message: `"${day}" is not a working day for this timetable`,
            });
        }

        const periodDef = timetable.periods.find((p) => p.number === Number(period));
        if (!periodDef) {
            return res.status(400).json({
                success: false,
                message: `Period ${period} is not defined`,
            });
        }

        if (periodDef.isBreak) {
            return res.status(400).json({
                success: false,
                message: 'Cannot assign a subject to a break period',
            });
        }

        // Validate subject belongs to same section (if section-based)
        if (subjectId && timetable.section) {
            const subject = await Subject.findById(subjectId);
            if (!subject) {
                return res.status(404).json({ success: false, message: 'Subject not found' });
            }
            if (subject.section && String(subject.section) !== String(timetable.section)) {
                return res.status(400).json({
                    success: false,
                    message: 'Subject does not belong to this section',
                });
            }
        }

        const slotIdx = timetable.slots.findIndex(
            (s) => s.day === day && s.period === Number(period)
        );

        if (slotIdx === -1) {
            timetable.slots.push({
                day,
                period:  Number(period),
                subject: subjectId || null,
                label:   '',
                isBreak: false,
            });
        } else {
            timetable.slots[slotIdx].subject = subjectId || null;
            timetable.slots[slotIdx].label   = '';
        }

        await timetable.save();

        const populated = await populateTimetable(Timetable.findById(timetable._id));
        res.status(200).json({ success: true, timetable: populated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/timetables/:id
exports.updateTimetable = async (req, res) => {
    try {
        const timetable = await Timetable.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!timetable) {
            return res.status(404).json({ success: false, message: 'Timetable not found' });
        }
        const populated = await populateTimetable(Timetable.findById(timetable._id));
        res.status(200).json({ success: true, timetable: populated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/timetables/:id
exports.deleteTimetable = async (req, res) => {
    try {
        const timetable = await Timetable.findByIdAndDelete(req.params.id);
        if (!timetable) {
            return res.status(404).json({ success: false, message: 'Timetable not found' });
        }
        res.status(200).json({ success: true, message: 'Timetable deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/timetables
exports.getAllTimetables = async (req, res) => {
    try {
        const { section, grade, academicYear, semester, course, isActive } = req.query;
        const filter = {};
        if (section)      filter.section      = section;
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);
        if (course)       filter.course       = course;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const timetables = await populateTimetable(
            Timetable.find(filter).sort({ createdAt: -1 })
        );

        res.status(200).json({ success: true, timetables });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/timetables/:id
exports.getTimetable = async (req, res) => {
    try {
        const timetable = await populateTimetable(Timetable.findById(req.params.id));
        if (!timetable) {
            return res.status(404).json({ success: false, message: 'Timetable not found' });
        }
        res.status(200).json({ success: true, timetable });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/timetables/my/student
// Student sees timetable for their active section and current semester
exports.getMyTimetableAsStudent = async (req, res) => {
    try {
        const studentSection = await StudentSection.findOne({
            student: req.user._id,
            status:  'active',
        }).populate({
            path:     'section',
            populate: { path: 'academicYear', select: 'currentSemester' },
        });

        if (!studentSection) {
            return res.status(200).json({
                success:    true,
                timetable:  null,
                message:    'Not assigned to any section',
            });
        }

        const semester = studentSection.section?.academicYear?.currentSemester || 1;

        const timetable = await populateTimetable(
            Timetable.findOne({
                section:  studentSection.section._id,
                semester,
                isActive: true,
            })
        );

        res.status(200).json({
            success:   true,
            timetable: timetable || null,
            section:   studentSection,
            semester,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/timetables/my/teacher
// Teacher sees all timetables containing their subjects
exports.getMyTimetableAsTeacher = async (req, res) => {
    try {
        const subjects = await Subject.find({ teacher: req.user._id }).select('_id section grade');

        if (subjects.length === 0) {
            return res.status(200).json({ success: true, timetables: [] });
        }

        const subjectIds  = subjects.map((s) => s._id);
        const sectionIds  = [...new Set(subjects.filter((s) => s.section).map((s) => String(s.section)))];

        const timetables = await populateTimetable(
            Timetable.find({
                section:         { $in: sectionIds },
                isActive:        true,
                'slots.subject': { $in: subjectIds },
            })
        );

        // Flag which slots belong to this teacher
        const withFlag = timetables.map((tt) => {
            const obj = tt.toObject ? tt.toObject({ virtuals: true }) : tt;
            obj.slots = obj.slots.map((slot) => ({
                ...slot,
                isMyClass: slot.subject
                    ? subjectIds.some((id) => String(id) === String(slot.subject?._id))
                    : false,
            }));
            return obj;
        });

        res.status(200).json({ success: true, timetables: withFlag });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};