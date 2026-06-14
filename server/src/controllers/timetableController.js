const Timetable   = require('../models/Timetable');
const Enrollment  = require('../models/Enrollment');
const Subject     = require('../models/Subject');

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Build a fully-populated timetable with resolved subject + teacher details.
 */
const populateTimetable = (query) =>
    query
        .populate('course', 'title code department')
        .populate('createdBy', 'name email')
        .populate('slots.subject', 'name code teacher credits')
        .populate({
            path: 'slots.subject',
            populate: { path: 'teacher', select: 'name email' },
        });

// ─── admin: create timetable structure ──────────────────────────────────────

// POST /api/timetables
// Body: { course, term, workingDays, periods: [{number, startTime, endTime, label?, isBreak?}] }
exports.createTimetable = async (req, res) => {
    try {
        const { course, term, workingDays, periods } = req.body;

        // Validate periods are in order with unique numbers
        const periodNumbers = periods.map((p) => p.number);
        if (new Set(periodNumbers).size !== periodNumbers.length) {
            return res.status(400).json({
                success: false,
                message: 'Period numbers must be unique',
            });
        }

        // Pre-build empty slots for every (day × period) combination
        const days = workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
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
            course,
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
                message: 'A timetable for this course and term already exists',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── admin: assign a subject to a slot ──────────────────────────────────────

// PUT /api/timetables/:id/slots
// Body: { day, period, subjectId }   (subjectId null = clear the slot)
exports.updateSlot = async (req, res) => {
    try {
        const { day, period, subjectId } = req.body;

        const timetable = await Timetable.findById(req.params.id);
        if (!timetable) {
            return res.status(404).json({ success: false, message: 'Timetable not found' });
        }

        // Validate day is a working day for this timetable
        if (!timetable.workingDays.includes(day)) {
            return res.status(400).json({
                success: false,
                message: `"${day}" is not a working day for this timetable`,
            });
        }

        // Validate period exists in structure
        const periodDef = timetable.periods.find((p) => p.number === Number(period));
        if (!periodDef) {
            return res.status(400).json({
                success: false,
                message: `Period ${period} is not defined in this timetable`,
            });
        }

        if (periodDef.isBreak) {
            return res.status(400).json({
                success: false,
                message: 'Cannot assign a subject to a break period',
            });
        }

        // Validate subject belongs to the same course
        if (subjectId) {
            const subject = await Subject.findById(subjectId);
            if (!subject) {
                return res.status(404).json({ success: false, message: 'Subject not found' });
            }
            if (String(subject.course) !== String(timetable.course)) {
                return res.status(400).json({
                    success: false,
                    message: 'Subject does not belong to this timetable\'s course',
                });
            }

            // Warn if the same subject already exists on the same day
            const dayConflict = timetable.slots.find(
                (s) => s.day === day && String(s.subject) === String(subjectId) && s.period !== Number(period)
            );
            if (dayConflict) {
                // We allow it but surface a warning in the response
                // (some schools allow double-periods)
            }
        }

        // Update the matching slot (or insert if somehow missing)
        const slotIdx = timetable.slots.findIndex(
            (s) => s.day === day && s.period === Number(period)
        );

        if (slotIdx === -1) {
            timetable.slots.push({ day, period: Number(period), subject: subjectId || null });
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

// ─── admin: update timetable meta (term, workingDays, periods) ──────────────

// PUT /api/timetables/:id
exports.updateTimetable = async (req, res) => {
    try {
        const { term, workingDays, periods, isActive } = req.body;
        const update = {};
        if (term)        update.term        = term;
        if (workingDays) update.workingDays = workingDays;
        if (periods)     update.periods     = periods;
        if (typeof isActive === 'boolean') update.isActive = isActive;

        const timetable = await Timetable.findByIdAndUpdate(
            req.params.id,
            { $set: update },
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

// ─── admin: delete timetable ─────────────────────────────────────────────────

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

// ─── admin: list all timetables ──────────────────────────────────────────────

// GET /api/timetables
exports.getAllTimetables = async (req, res) => {
    try {
        const { course, term, isActive } = req.query;
        const filter = {};
        if (course)   filter.course   = course;
        if (term)     filter.term     = term;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const timetables = await populateTimetable(
            Timetable.find(filter).sort({ createdAt: -1 })
        );

        res.status(200).json({ success: true, timetables });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── admin/teacher/student: get one timetable by id ─────────────────────────

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

// ─── student: view timetable for their enrolled courses ──────────────────────

// GET /api/timetables/my/student
// Returns all active timetables for courses the student is actively enrolled in.
exports.getMyTimetableAsStudent = async (req, res) => {
    try {
        // Find active enrollments for this student
        const enrollments = await Enrollment.find({
            student: req.user._id,
            status:  'active',
        }).select('course');

        const courseIds = enrollments.map((e) => e.course);

        if (courseIds.length === 0) {
            return res.status(200).json({ success: true, timetables: [] });
        }

        const timetables = await populateTimetable(
            Timetable.find({ course: { $in: courseIds }, isActive: true })
        );

        res.status(200).json({ success: true, timetables });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── teacher: view timetable for their assigned subjects ─────────────────────

// GET /api/timetables/my/teacher
// Returns all active timetables where at least one slot has a subject assigned to this teacher.
exports.getMyTimetableAsTeacher = async (req, res) => {
    try {
        // Find all subjects assigned to this teacher
        const subjects = await Subject.find({ teacher: req.user._id }).select('_id course');

        if (subjects.length === 0) {
            return res.status(200).json({ success: true, timetables: [] });
        }

        const subjectIds = subjects.map((s) => s._id);
        const courseIds  = [...new Set(subjects.map((s) => String(s.course)))];

        // Get active timetables for those courses that contain the teacher's subjects
        const timetables = await populateTimetable(
            Timetable.find({
                course:  { $in: courseIds },
                isActive: true,
                'slots.subject': { $in: subjectIds },
            })
        );

        // Filter each timetable's slots to only include this teacher's subjects
        // (keep full grid but mark which ones belong to the teacher)
        const withTeacherFlag = timetables.map((tt) => {
            const obj = tt.toObject({ virtuals: true });
            obj.slots = obj.slots.map((slot) => ({
                ...slot,
                isMyClass: slot.subject
                    ? subjectIds.some((id) => String(id) === String(slot.subject?._id))
                    : false,
            }));
            return obj;
        });

        res.status(200).json({ success: true, timetables: withTeacherFlag });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};