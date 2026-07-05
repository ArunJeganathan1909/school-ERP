const Timetable                = require('../models/Timetable');
const TimetableStructure       = require('../models/TimetableStructure');
const StudentSection           = require('../models/StudentSection');
const Subject                  = require('../models/Subject');
const SubjectTeacherAssignment = require('../models/SubjectTeacherAssignment');
const PDFDocument              = require('pdfkit');
const { addHeader }            = require('../utils/pdfGenerator');

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── helpers ───────────────────────────────────────────────────────────────────

const populateTimetable = (query) =>
    query
        .populate('section',      'name room')
        .populate('grade',        'name gradeNumber stream')
        .populate('academicYear', 'name currentSemester')
        .populate('structureRef', 'name workingDays periods')
        .populate('createdBy',    'name email')
        .populate('slots.subjects', 'name code credits bucket');

// A small fixed palette, deterministically assigned per section/bucket name
// so the same section always gets the same color across a document.
const PALETTE = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'];
function colorForKey(key) {
    if (!key) return COLORS_LOCAL.primary;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return PALETTE[hash % PALETTE.length];
}

// Local copy of the palette pdfGenerator.js uses internally, so this file
// doesn't need to reach into its private constants.
const COLORS_LOCAL = {
    primary: '#4F46E5',
    primaryDark: '#3730A3',
    dark: '#111827',
    muted: '#6B7280',
    border: '#E5E7EB',
    zebra: '#FAFBFF',
    breakBg: '#F3F4F6',
};

// Draws a bordered day×period grid with colored, multi-line cell entries.
// `getCellEntries(day, periodNumber)` must return an array of
// { title, subtitle, color } — one per subject occupying that slot.
function drawTimetableGrid(doc, { workingDays, periods, getCellEntries, todayName }) {
    const marginX     = 40;
    const tableWidth  = doc.page.width - marginX * 2;
    const periodColW  = 95;
    const dayColW     = (tableWidth - periodColW) / (workingDays.length || 1);
    const headerH     = 26;
    let y = doc.y;

    const drawColumnHeaders = () => {
        doc.rect(marginX, y, periodColW, headerH).fill(COLORS_LOCAL.primaryDark);
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
            .text('PERIOD', marginX, y + 9, { width: periodColW, align: 'center' });

        workingDays.forEach((day, i) => {
            const x = marginX + periodColW + i * dayColW;
            doc.rect(x, y, dayColW, headerH).fill(day === todayName ? COLORS_LOCAL.primaryDark : COLORS_LOCAL.primary);
            doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
                .text(day.toUpperCase(), x, y + 9, { width: dayColW, align: 'center' });
        });
        y += headerH;
    };

    drawColumnHeaders();

    periods.forEach((period, rowIdx) => {
        let maxEntries = 1;
        if (!period.isBreak) {
            workingDays.forEach((day) => {
                maxEntries = Math.max(maxEntries, getCellEntries(day, period.number).length || 1);
            });
        }
        const rowH = period.isBreak ? 24 : Math.max(42, 16 + maxEntries * 24);

        if (y + rowH > doc.page.height - 70) {
            doc.addPage();
            y = 50;
            drawColumnHeaders();
        }

        if (period.isBreak) {
            doc.rect(marginX, y, tableWidth, rowH).fill(COLORS_LOCAL.breakBg);
            doc.fillColor(COLORS_LOCAL.muted).fontSize(8.5).font('Helvetica-Oblique')
                .text(`${period.label || 'Break'}   ${period.startTime}–${period.endTime}`, marginX, y + 7, { width: tableWidth, align: 'center' });
            doc.strokeColor(COLORS_LOCAL.border).lineWidth(0.5)
                .rect(marginX, y, tableWidth, rowH).stroke();
            y += rowH;
            return;
        }

        if (rowIdx % 2 === 0) {
            doc.rect(marginX, y, tableWidth, rowH).fill(COLORS_LOCAL.zebra);
        }

        doc.fillColor(COLORS_LOCAL.dark).fontSize(9.5).font('Helvetica-Bold')
            .text(`P${period.number}`, marginX + 8, y + 8);
        doc.fillColor(COLORS_LOCAL.muted).fontSize(7.5).font('Helvetica')
            .text(`${period.startTime}–${period.endTime}`, marginX + 8, y + 21, { width: periodColW - 12 });

        workingDays.forEach((day, i) => {
            const x = marginX + periodColW + i * dayColW;
            const entries = getCellEntries(day, period.number);

            if (entries.length === 0) {
                doc.fillColor(COLORS_LOCAL.muted).fontSize(9).font('Helvetica')
                    .text('—', x, y + rowH / 2 - 5, { width: dayColW, align: 'center' });
            } else {
                let cellY = y + (rowH - entries.length * 24) / 2 + 2;
                entries.forEach((entry) => {
                    doc.rect(x + 6, cellY, 3, 18).fill(entry.color || COLORS_LOCAL.primary);
                    doc.fillColor(COLORS_LOCAL.dark).fontSize(8.5).font('Helvetica-Bold')
                        .text(entry.title, x + 13, cellY, { width: dayColW - 18, lineBreak: false });
                    doc.fillColor(COLORS_LOCAL.muted).fontSize(7).font('Helvetica')
                        .text(entry.subtitle, x + 13, cellY + 11, { width: dayColW - 18, lineBreak: false });
                    cellY += 24;
                });
            }
        });

        // Grid lines for this row
        doc.strokeColor(COLORS_LOCAL.border).lineWidth(0.5);
        for (let i = 0; i <= workingDays.length; i++) {
            const lx = marginX + periodColW + i * dayColW;
            doc.moveTo(lx, y).lineTo(lx, y + rowH).stroke();
        }
        doc.moveTo(marginX, y).lineTo(marginX, y + rowH).stroke();
        doc.moveTo(marginX, y + rowH).lineTo(marginX + tableWidth, y + rowH).stroke();

        y += rowH;
    });

    doc.y = y + 16;
}

// Small color-key legend under the grid — e.g. one swatch per section for a
// teacher's merged schedule, or one per elective bucket for a student.
function drawLegend(doc, items) {
    if (!items || items.length === 0) return;
    const marginX = 40;

    // If there isn't roughly enough room left for a legend line, start a
    // fresh page ourselves rather than letting pdfkit silently add one
    // mid-write (which is what was causing one extra page per item).
    if (doc.y + 40 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
    }

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLORS_LOCAL.muted)
        .text('LEGEND', marginX, doc.y);
    doc.moveDown(0.6);

    doc.fontSize(8).font('Helvetica'); // fixed size used for every swatch label below
    let lx = marginX;
    let ly = doc.y;
    items.forEach((item) => {
        const labelW = doc.widthOfString(item.label);
        if (lx + 20 + labelW > doc.page.width - marginX) {
            lx = marginX;
            ly += 16;
            if (ly + 16 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                ly = doc.y;
            }
        }
        doc.rect(lx, ly, 8, 8).fill(item.color);
        doc.fillColor(COLORS_LOCAL.dark).fontSize(8).font('Helvetica')
            .text(item.label, lx + 12, ly - 1, { lineBreak: false });
        lx += 20 + labelW + 16;
    });
    doc.y = ly + 20;
}

// Stamps "Generated on <date>" + "Page X of Y" on every buffered page.
// Requires the PDFDocument to be created with { bufferPages: true }.
function addFooters(doc) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Writing this close to the bottom edge would normally make pdfkit
        // think the content overflowed and silently start a new page —
        // temporarily suppress that so the footer actually lands on the
        // page we just switched to.
        const originalBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const y = doc.page.height - 30;
        doc.fontSize(7.5).fillColor(COLORS_LOCAL.muted).font('Helvetica')
            .text(`Generated on ${new Date().toLocaleDateString()}`, 40, y, { lineBreak: false });
        doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - 140, y, { width: 100, align: 'right', lineBreak: false });

        doc.page.margins.bottom = originalBottomMargin;
    }
}

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
// ── GET /api/timetables/my/student/pdf ───────────────────────────────────────
// Student downloads their own section's timetable as a PDF.
exports.downloadMyTimetablePdfAsStudent = async (req, res) => {
    try {
        const studentSection = await StudentSection.findOne({
            student: req.user._id,
            status:  'active',
        }).populate({
            path:     'section',
            populate: [
                { path: 'grade',        select: 'gradeNumber name' },
                { path: 'academicYear', select: 'currentSemester name' },
            ],
        });

        if (!studentSection) {
            return res.status(404).json({ success: false, message: 'Not assigned to any section' });
        }

        const semester = studentSection.section?.academicYear?.currentSemester || 1;

        const timetable = await populateTimetable(
            Timetable.findOne({ section: studentSection.section._id, semester, isActive: true })
        );

        if (!timetable) {
            return res.status(404).json({ success: false, message: 'No timetable found for your section' });
        }

        const sectionLabel = `Grade ${studentSection.section?.grade?.gradeNumber || ''}${studentSection.section?.name || ''}`;
        const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape', bufferPages: true });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="timetable-${sectionLabel.replace(/\s+/g, '')}.pdf"`);
        doc.pipe(res);

        addHeader(
            doc,
            'Class Timetable',
            `${sectionLabel}  ·  ${timetable.term}  ·  Semester ${timetable.semester}  ·  ${studentSection.section?.academicYear?.name || ''}  ·  ${req.user.name || ''}`
        );

        const workingDays = timetable.workingDays || [];
        const periods      = [...(timetable.periods || [])].sort((a, b) => a.number - b.number);
        const bucketsUsed  = new Set();

        const getCellEntries = (day, periodNumber) => {
            const slot = timetable.slots.find((s) => s.day === day && s.period === periodNumber);
            if (!slot?.subjects?.length) return [];
            return slot.subjects.map((subj) => {
                if (slot.bucket) bucketsUsed.add(slot.bucket);
                return {
                    title:    subj.name,
                    subtitle: subj.code,
                    color:    colorForKey(slot.bucket || subj.code),
                };
            });
        };

        drawTimetableGrid(doc, { workingDays, periods, getCellEntries, todayName });

        const legendItems = [...bucketsUsed].map((bucket) => ({ label: bucket, color: colorForKey(bucket) }));
        drawLegend(doc, legendItems);

        addFooters(doc);
        doc.end();
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: err.message });
        } else {
            res.end();
        }
    }
};

// ── GET /api/timetables/my/teacher/pdf ───────────────────────────────────────
// Teacher downloads ONE merged PDF across every section they teach —
// mirrors the merged grid shown in TimetableViewer.jsx.
exports.downloadMyTimetablePdfAsTeacher = async (req, res) => {
    try {
        const assignments = await SubjectTeacherAssignment.find({
            teacher:  req.user._id,
            isActive: true,
        }).select('subject section');

        if (assignments.length === 0) {
            return res.status(404).json({ success: false, message: 'No classes assigned yet' });
        }

        const sectionIds = [...new Set(assignments.map((a) => String(a.section)))];

        const timetables = await populateTimetable(
            Timetable.find({ section: { $in: sectionIds }, isActive: true })
        );

        const workingDaysSet  = new Set();
        const periodsByNumber = new Map();
        const cellMap         = new Map(); // "day|period" -> [{ subject, sectionLabel }]

        timetables.forEach((tt) => {
            const obj = tt.toObject ? tt.toObject({ virtuals: true }) : tt;

            obj.workingDays?.forEach((d) => workingDaysSet.add(d));
            obj.periods?.forEach((p) => {
                if (!periodsByNumber.has(p.number)) periodsByNumber.set(p.number, p);
            });

            const teacherSubjectsInSection = assignments
                .filter((a) => String(a.section) === String(obj.section?._id || obj.section))
                .map((a) => String(a.subject));

            const sectionLabel = obj.section
                ? `${obj.grade?.gradeNumber || ''}${obj.section?.name}`
                : obj.term;

            obj.slots?.forEach((slot) => {
                const mySubjects = (slot.subjects || []).filter((s) =>
                    teacherSubjectsInSection.includes(String(s._id || s))
                );
                if (mySubjects.length === 0) return;

                const key     = `${slot.day}|${slot.period}`;
                const entries = cellMap.get(key) || [];
                mySubjects.forEach((subject) => entries.push({ subject, sectionLabel }));
                cellMap.set(key, entries);
            });
        });

        const workingDays = DAY_ORDER.filter((d) => workingDaysSet.has(d));
        const periods      = [...periodsByNumber.values()].sort((a, b) => a.number - b.number);
        const todayName    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
        const sectionsUsed = new Set();

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape', bufferPages: true });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="my-teaching-schedule.pdf"`);
        doc.pipe(res);

        addHeader(
            doc,
            'Teaching Schedule',
            `${req.user.name || 'Teacher'}  ·  across ${timetables.length} section${timetables.length !== 1 ? 's' : ''}`
        );

        const getCellEntries = (day, periodNumber) => {
            const entries = cellMap.get(`${day}|${periodNumber}`) || [];
            return entries.map((e) => {
                sectionsUsed.add(e.sectionLabel);
                return {
                    title:    e.subject.name,
                    subtitle: `Grade ${e.sectionLabel}`,
                    color:    colorForKey(e.sectionLabel),
                };
            });
        };

        drawTimetableGrid(doc, { workingDays, periods, getCellEntries, todayName });

        const legendItems = [...sectionsUsed].map((label) => ({ label: `Grade ${label}`, color: colorForKey(label) }));
        drawLegend(doc, legendItems);

        addFooters(doc);
        doc.end();
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: err.message });
        } else {
            res.end();
        }
    }
};