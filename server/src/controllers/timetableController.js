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
        .populate('slots.subjects', 'name code credits bucket');

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

// ── Slot/bucket helpers ────────────────────────────────────────────────────────

// A subject with a bucket is one option among several mutually-exclusive
// electives (e.g. Art / Music). Since a student attends whichever one they
// picked, all siblings in the bucket must occupy the SAME day+period so no
// section timetable has a gap. Mandatory subjects (bucket === null) are
// just themselves — a group of one.
async function resolveSubjectGroup(subject) {
    if (!subject.bucket) return [subject];

    const filter = {
        bucket:      subject.bucket,
        isMandatory: false,
        isActive:    true,
    };
    if (subject.gradeRange) {
        filter.gradeRange = subject.gradeRange;
    } else if (subject.grade) {
        filter.grade        = subject.grade;
        filter.academicYear = subject.academicYear;
    }

    const siblings = await Subject.find(filter);
    if (!siblings.some((s) => String(s._id) === String(subject._id))) {
        siblings.push(subject);
    }
    return siblings;
}

function writeSlot(timetable, day, period, subjectIds, bucket) {
    const idx = timetable.slots.findIndex((s) => s.day === day && s.period === period);
    if (idx === -1) {
        timetable.slots.push({ day, period, subjects: subjectIds, bucket: bucket || null, label: '', isBreak: false });
    } else {
        timetable.slots[idx].subjects = subjectIds;
        timetable.slots[idx].bucket   = bucket || null;
        timetable.slots[idx].label    = '';
    }
}

function clearSlotInPlace(timetable, day, period) {
    const idx = timetable.slots.findIndex((s) => s.day === day && s.period === period);
    if (idx !== -1) {
        timetable.slots[idx].subjects = [];
        timetable.slots[idx].bucket   = null;
    }
}

// Checks every subject in the candidate group against every other active
// timetable, for a teacher already booked at this day+period. Returns a
// ready-to-send 409 payload, or null if there's no conflict.
async function findTeacherConflict(timetable, day, period, subjectIds) {
    const assignments = await SubjectTeacherAssignment.find({
        subject:  { $in: subjectIds },
        section:  timetable.section,
        isActive: true,
    }).populate('teacher', 'name');

    if (assignments.length === 0) return null; // no teacher assigned yet — nothing to conflict on

    const otherTimetables = await Timetable.find({
        academicYear: timetable.academicYear,
        _id:          { $ne: timetable._id },
        isActive:     true,
    }).select('slots section grade term');

    for (const other of otherTimetables) {
        const slot = other.slots.find((s) => s.day === day && s.period === period && s.subjects?.length);
        if (!slot) continue;

        const otherAssignments = await SubjectTeacherAssignment.find({
            subject:  { $in: slot.subjects },
            section:  other.section,
            isActive: true,
        });

        for (const oa of otherAssignments) {
            const mine = assignments.find((a) => String(a.teacher._id) === String(oa.teacher));
            if (mine) {
                await other.populate([
                    { path: 'section', select: 'name' },
                    { path: 'grade',   select: 'name gradeNumber' },
                ]);
                return {
                    success: false,
                    conflict: true,
                    message: `Teacher conflict: ${mine.teacher.name} is already teaching in Grade ${other.grade?.gradeNumber}${other.section?.name} at ${day} Period ${period} (${other.term})`,
                    details: {
                        teacher:            mine.teacher.name,
                        conflictingSection: `Grade ${other.grade?.gradeNumber}${other.section?.name}`,
                        conflictingTerm:    other.term,
                        day,
                        period,
                    },
                };
            }
        }
    }
    return null;
}

// Applies the same day/period/subjects/bucket to every other timetable
// sharing this grade + academicYear + semester, so an elective bucket lands
// on the same slot for every section in the grade. Skips (and reports) any
// section whose slot is already taken by something else, rather than
// overwriting it silently.
async function syncBucketAcrossGrade(timetable, day, period, subjectIds, bucket) {
    if (!timetable.grade) return { applied: [], skipped: [] };

    const siblings = await Timetable.find({
        grade:        timetable.grade,
        academicYear: timetable.academicYear,
        semester:     timetable.semester,
        _id:          { $ne: timetable._id },
        isActive:     true,
    }).populate('section', 'name');

    const applied = [];
    const skipped = [];

    for (const sibling of siblings) {
        const existing = sibling.slots.find((s) => s.day === day && s.period === period);
        const isEmpty      = !existing || !existing.subjects?.length;
        const isSameBucket = existing?.bucket && bucket && existing.bucket === bucket;

        if (!isEmpty && !isSameBucket) {
            skipped.push({ section: sibling.section?.name || 'Unknown', reason: 'Slot already occupied' });
            continue;
        }

        if (subjectIds) {
            const conflict = await findTeacherConflict(sibling, day, period, subjectIds);
            if (conflict) {
                skipped.push({ section: sibling.section?.name || 'Unknown', reason: 'Teacher conflict' });
                continue;
            }
            writeSlot(sibling, day, period, subjectIds, bucket);
        } else {
            clearSlotInPlace(sibling, day, period);
        }

        await sibling.save();
        applied.push(sibling.section?.name || 'Unknown');
    }

    return { applied, skipped };
}

// ── PUT /api/timetables/:id/slots ─────────────────────────────────────────────
// Assign or clear a subject in a slot — WITH teacher conflict check.
// If the subject belongs to an elective bucket, every sibling subject in
// that bucket is written into the same slot. If applyToGrade is true
// (default), the same day/period/bucket is synced across every other
// section's timetable in the same grade.
exports.updateSlot = async (req, res) => {
    try {
        const { day, period, subjectId, applyToGrade = true } = req.body;
        const periodNum = Number(period);

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

        const periodDef = timetable.periods.find((p) => p.number === periodNum);
        if (!periodDef) {
            return res.status(400).json({ success: false, message: `Period ${period} is not defined` });
        }
        if (periodDef.isBreak) {
            return res.status(400).json({ success: false, message: 'Cannot assign a subject to a break period' });
        }

        // ── Clearing a slot ──────────────────────────────────────────────────────
        if (!subjectId) {
            clearSlotInPlace(timetable, day, periodNum);
            await timetable.save();

            let sync = { applied: [], skipped: [] };
            if (applyToGrade) {
                sync = await syncBucketAcrossGrade(timetable, day, periodNum, null, null);
            }

            const populated = await populateTimetable(Timetable.findById(timetable._id));
            return res.status(200).json({ success: true, timetable: populated, sync });
        }

        // ── Resolve the subject group (bucket siblings, or just itself) ─────────
        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }

        const groupSubjects = await resolveSubjectGroup(subject);
        const groupIds      = groupSubjects.map((s) => s._id);

        // ── Teacher conflict check for every subject in the group ──────────────
        const conflict = await findTeacherConflict(timetable, day, periodNum, groupIds);
        if (conflict) return res.status(409).json(conflict);

        // ── Write the slot for this section ─────────────────────────────────────
        writeSlot(timetable, day, periodNum, groupIds, subject.bucket || null);
        await timetable.save();

        // ── Propagate to sibling sections in the same grade (buckets only) ─────
        let sync = { applied: [], skipped: [] };
        if (applyToGrade && subject.bucket) {
            sync = await syncBucketAcrossGrade(timetable, day, periodNum, groupIds, subject.bucket);
        }

        const populated = await populateTimetable(Timetable.findById(timetable._id));
        res.status(200).json({ success: true, timetable: populated, sync });
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
                (s) => s.day === day && s.period === periodNum && s.subjects?.length
            );
            if (conflictSlot) {
                // Who teaches these subjects in that section?
                const busyAssignments = await SubjectTeacherAssignment.find({
                    subject:  { $in: conflictSlot.subjects },
                    section:  tt.section,
                    isActive: true,
                });
                busyAssignments.forEach((a) => busyTeacherIds.add(String(a.teacher)));
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
            return res.status(200).json({ success: true, timetables: [], message: 'Not assigned to any section' });
        }

        const semester = studentSection.section?.academicYear?.currentSemester || 1;

        const timetable = await populateTimetable(
            Timetable.findOne({ section: studentSection.section._id, semester, isActive: true })
        );

        // Matches the shape fetchMyTimetableAsStudent's thunk expects
        // (same "timetables" array key as getMyTimetableAsTeacher), plus
        // the student's section/semester context for the page header.
        res.status(200).json({
            success:   true,
            timetables: timetable ? [timetable] : [],
            section:   studentSection,
            semester,
        });
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

            obj.myTeacherSubjectIds = teacherSubjectsInSection;
            obj.slots = obj.slots.map((slot) => ({
                ...slot,
                isMyClass: slot.subjects?.some((subj) =>
                    teacherSubjectsInSection.includes(String(subj?._id || subj))
                ) || false,
            }));
            return obj;
        });

        res.status(200).json({ success: true, timetables: withFlag });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};