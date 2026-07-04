const Timetable                = require('../models/Timetable');
const TimetableStructure       = require('../models/TimetableStructure');
const StudentSection           = require('../models/StudentSection');
const Subject                  = require('../models/Subject');
const SubjectTeacherAssignment = require('../models/SubjectTeacherAssignment');

// ── helpers ───────────────────────────────────────────────────────────────────

const populateTimetable = (query) =>
    query
        .populate('section',      'name room')
        .populate('grade',        'name gradeNumber stream')
        .populate('academicYear', 'name currentSemester')
        .populate('structureRef', 'name workingDays periods')
        .populate('createdBy',    'name email')
        .populate('slots.subject', 'name code credits');

// ── POST /api/timetables ──────────────────────────────────────────────────────
// Create a timetable for a section from a structure
exports.createTimetable = async (req, res) => {
    try {
        const {
            section, grade, academicYear, semester,
            structureRef, term,
        } = req.body;

        if (!structureRef) {
            return res.status(400).json({
                success: false,
                message: 'structureRef is required — select a timetable structure for this academic year',
            });
        }

        const structure = await TimetableStructure.findById(structureRef);
        if (!structure) {
            return res.status(404).json({ success: false, message: 'Timetable structure not found' });
        }

        // Build empty slot grid from the structure's periods and working days
        const slots = [];
        for (const day of structure.workingDays) {
            for (const period of structure.periods) {
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
            structureRef,
            section:      section      || null,
            grade:        grade        || null,
            academicYear: academicYear || null,
            semester:     semester     || structure.semester || 1,
            term:         term || `${structure.name || 'Timetable'} — Semester ${semester || 1}`,
            workingDays:  structure.workingDays,
            periods:      structure.periods,
            slots,
            createdBy:    req.user._id,
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

// ── PUT /api/timetables/:id/slots ─────────────────────────────────────────────
// Assign or clear a subject in a slot — WITH teacher conflict check
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

        // ── Teacher conflict check ──────────────────────────────────────────────
        if (subjectId) {
            const subject = await Subject.findById(subjectId);
            if (!subject) {
                return res.status(404).json({ success: false, message: 'Subject not found' });
            }

            // Find who teaches this subject in this section
            const assignment = await SubjectTeacherAssignment.findOne({
                subject: subjectId,
                section: timetable.section,
                isActive: true,
            }).populate('teacher', 'name email');

            if (assignment) {
                const teacherId = assignment.teacher._id;

                // Find ALL timetables in the same academic year EXCEPT this one
                const otherTimetables = await Timetable.find({
                    academicYear: timetable.academicYear,
                    _id:          { $ne: timetable._id },
                    isActive:     true,
                }).select('slots section grade term');

                for (const other of otherTimetables) {
                    // Check if this teacher has a subject assigned in the same day+period
                    const conflictSlot = other.slots.find(
                        (s) => s.day === day && s.period === Number(period) && s.subject
                    );

                    if (conflictSlot) {
                        // Is this conflicting subject taught by the same teacher?
                        const conflictAssignment = await SubjectTeacherAssignment.findOne({
                            subject:  conflictSlot.subject,
                            section:  other.section,
                            teacher:  teacherId,
                            isActive: true,
                        });

                        if (conflictAssignment) {
                            // Populate conflicting timetable info for a helpful error
                            await other.populate([
                                { path: 'section', select: 'name' },
                                { path: 'grade',   select: 'name gradeNumber' },
                            ]);

                            return res.status(409).json({
                                success: false,
                                conflict: true,
                                message: `Teacher conflict: ${assignment.teacher.name} is already teaching in Grade ${other.grade?.gradeNumber}${other.section?.name} at ${day} Period ${period} (${other.term})`,
                                details: {
                                    teacher:           assignment.teacher.name,
                                    conflictingSection: `Grade ${other.grade?.gradeNumber}${other.section?.name}`,
                                    conflictingTerm:    other.term,
                                    day,
                                    period: Number(period),
                                },
                            });
                        }
                    }
                }
            }
            // No conflict — proceed
        }

        // Update the slot
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

// ── GET /api/timetables/free-subjects?sectionId=&day=&period=&academicYear= ──
// Returns subjects available for this section at this slot
// (filters out subjects whose assigned teacher is busy at this slot)
exports.getFreeSubjectsForSlot = async (req, res) => {
    try {
        const { sectionId, day, period, academicYear } = req.query;
        const periodNum = Number(period);

        // All teacher assignments for this section
        const sectionAssignments = await SubjectTeacherAssignment.find({
            section:  sectionId,
            isActive: true,
        }).populate('subject', 'name code isMandatory bucket semester');

        if (sectionAssignments.length === 0) {
            return res.status(200).json({ success: true, subjects: [], busyTeachers: [] });
        }

        // Find all teachers busy at this slot across all other timetables
        const otherTimetables = await Timetable.find({
            academicYear,
            section: { $ne: sectionId },
            isActive: true,
        }).select('slots section');

        const busyTeacherIds = new Set();

        for (const tt of otherTimetables) {
            const conflictSlot = tt.slots.find(
                (s) => s.day === day && s.period === periodNum && s.subject
            );
            if (conflictSlot) {
                // Who teaches this subject in that section?
                const busyAssignment = await SubjectTeacherAssignment.findOne({
                    subject:  conflictSlot.subject,
                    section:  tt.section,
                    isActive: true,
                });
                if (busyAssignment) {
                    busyTeacherIds.add(String(busyAssignment.teacher));
                }
            }
        }

        // Split assignments into free and busy
        const free = [];
        const busy = [];

        for (const a of sectionAssignments) {
            if (!a.subject) continue;
            const entry = {
                _id:     a.subject._id,
                name:    a.subject.name,
                code:    a.subject.code,
                bucket:  a.subject.bucket,
                semester: a.subject.semester,
                teacher: {
                    _id:   a.teacher,
                    name:  '', // populated below
                    email: '',
                },
                assignmentId: a._id,
            };

            if (busyTeacherIds.has(String(a.teacher))) {
                busy.push({ ...entry, conflict: true });
            } else {
                free.push({ ...entry, conflict: false });
            }
        }

        // Populate teacher names for the response
        const User = require('../models/User');
        const teacherIds  = [...new Set([...free, ...busy].map((s) => String(s.teacher._id)))];
        const teachers    = await User.find({ _id: { $in: teacherIds } }).select('name email');
        const teacherMap  = Object.fromEntries(teachers.map((t) => [String(t._id), t]));

        const withTeacher = (list) => list.map((s) => ({
            ...s,
            teacher: teacherMap[String(s.teacher._id)] || s.teacher,
        }));

        res.status(200).json({
            success:      true,
            subjects:     withTeacher(free),
            busySubjects: withTeacher(busy),
            busyCount:    busy.length,
            freeCount:    free.length,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /api/timetables/:id ───────────────────────────────────────────────────
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

// ── DELETE /api/timetables/:id ────────────────────────────────────────────────
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

// ── GET /api/timetables ───────────────────────────────────────────────────────
exports.getAllTimetables = async (req, res) => {
    try {
        const { section, grade, academicYear, semester, isActive } = req.query;
        const filter = {};
        if (section)      filter.section      = section;
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const timetables = await populateTimetable(
            Timetable.find(filter).sort({ createdAt: -1 })
        );

        res.status(200).json({ success: true, timetables });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/timetables/:id ───────────────────────────────────────────────────
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

// ── GET /api/timetables/my/student ───────────────────────────────────────────
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
            return res.status(200).json({ success: true, timetable: null, message: 'Not assigned to any section' });
        }

        const semester = studentSection.section?.academicYear?.currentSemester || 1;

        const timetable = await populateTimetable(
            Timetable.findOne({ section: studentSection.section._id, semester, isActive: true })
        );

        res.status(200).json({ success: true, timetable: timetable || null, section: studentSection, semester });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/timetables/my/teacher ───────────────────────────────────────────
exports.getMyTimetableAsTeacher = async (req, res) => {
    try {
        // Find all sections where this teacher is assigned to at least one subject
        const assignments = await SubjectTeacherAssignment.find({
            teacher:  req.user._id,
            isActive: true,
        }).select('subject section');

        if (assignments.length === 0) {
            return res.status(200).json({ success: true, timetables: [] });
        }

        const subjectIds = assignments.map((a) => a.subject);
        const sectionIds = [...new Set(assignments.map((a) => String(a.section)))];

        const timetables = await populateTimetable(
            Timetable.find({ section: { $in: sectionIds }, isActive: true })
        );

        // Flag which slots belong to this teacher's subjects
        const withFlag = timetables.map((tt) => {
            const obj = tt.toObject ? tt.toObject({ virtuals: true }) : tt;

            // Which subjects does this teacher teach in THIS section?
            const teacherSubjectsInSection = assignments
                .filter((a) => String(a.section) === String(tt.section?._id || tt.section))
                .map((a) => String(a.subject));

            obj.slots = obj.slots.map((slot) => ({
                ...slot,
                isMyClass: slot.subject
                    ? teacherSubjectsInSection.includes(String(slot.subject?._id || slot.subject))
                    : false,
            }));
            return obj;
        });

        res.status(200).json({ success: true, timetables: withFlag });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};