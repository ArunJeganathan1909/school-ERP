const StudentSection    = require('../models/StudentSection');
const Section           = require('../models/Section');
const Grade             = require('../models/Grade');
const AcademicYear      = require('../models/AcademicYear');
const User              = require('../models/User');
const SubjectEnrollment = require('../models/SubjectEnrollment');
const Subject           = require('../models/Subject');
const { autoEnrollMandatory } = require('./subjectEnrollmentController');

// ─── Helper: sync denormalized User fields ────────────────────────────────────
async function syncUserFields(studentId, { gradeNumber, sectionName, rollNumber }) {
    await User.findByIdAndUpdate(studentId, {
        $set: {
            currentGrade:   gradeNumber   ?? null,
            currentSection: sectionName   ?? null,
            rollNumber:     rollNumber    ?? '',
        },
    });
}

// ─── POST /api/student-sections/assign ───────────────────────────────────────
exports.assignStudent = async (req, res) => {
    try {
        const { studentId, sectionId, rollNumber } = req.body;

        // Validate student
        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Validate section
        const section = await Section.findById(sectionId)
            .populate('grade',        'gradeNumber name')
            .populate('academicYear', 'name currentSemester');
        if (!section) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        // Check capacity
        const currentCount = await StudentSection.countDocuments({ section: sectionId, status: 'active' });
        if (currentCount >= section.capacity) {
            return res.status(400).json({
                success: false,
                message: `Section ${section.grade?.gradeNumber}${section.name} is at full capacity (${section.capacity})`,
            });
        }

        // Check existing assignment this academic year
        const existing = await StudentSection.findOne({
            student:      studentId,
            academicYear: section.academicYear._id,
        });

        let record;

        if (existing) {
            if (existing.status === 'active') {
                return res.status(400).json({
                    success: false,
                    message: 'Student is already assigned to a section this academic year. Use transfer instead.',
                });
            }
            // Re-activate withdrawn record
            existing.section    = sectionId;
            existing.grade      = section.grade._id;
            existing.rollNumber = rollNumber || existing.rollNumber;
            existing.status     = 'active';
            existing.joinedAt   = Date.now();
            existing.leftAt     = null;
            await existing.save();
            record = existing;
        } else {
            record = await StudentSection.create({
                student:      studentId,
                section:      sectionId,
                grade:        section.grade._id,
                academicYear: section.academicYear._id,
                rollNumber:   rollNumber || '',
                status:       'active',
            });
        }

        // Sync denormalized User fields
        await syncUserFields(studentId, {
            gradeNumber:  section.grade?.gradeNumber,
            sectionName:  section.name,
            rollNumber:   rollNumber || record.rollNumber,
        });

        // ── Auto-enroll mandatory subjects ────────────────────────────────────
        const { enrolled, skipped } = await autoEnrollMandatory({
            studentId,
            sectionId,
            gradeId:       section.grade._id,
            gradeNumber:   section.grade?.gradeNumber,
            academicYearId: section.academicYear._id,
            semester:      section.academicYear.currentSemester || 1,
        });

        await record.populate([
            { path: 'student',      select: 'name email' },
            { path: 'section',      select: 'name' },
            { path: 'grade',        select: 'name gradeNumber' },
            { path: 'academicYear', select: 'name' },
        ]);

        res.status(existing ? 200 : 201).json({
            success: true,
            record,
            mandatorySubjectsEnrolled: enrolled,
            mandatorySubjectsSkipped:  skipped,
            message: existing
                ? `Student re-assigned. ${enrolled} mandatory subject(s) enrolled.`
                : `Student assigned. ${enrolled} mandatory subject(s) enrolled.`,
        });
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

// ─── PUT /api/student-sections/transfer ──────────────────────────────────────
exports.transferStudent = async (req, res) => {
    try {
        const { studentId, newSectionId, transferNote } = req.body;

        // Find current active assignment
        const currentRecord = await StudentSection.findOne({ student: studentId, status: 'active' });
        if (!currentRecord) {
            return res.status(404).json({
                success: false,
                message: 'No active section assignment found for this student',
            });
        }

        // Validate new section
        const newSection = await Section.findById(newSectionId)
            .populate('grade',        'gradeNumber name')
            .populate('academicYear', 'name currentSemester');
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
            return res.status(400).json({ success: false, message: 'Target section is at full capacity' });
        }

        // Mark current as transferred
        currentRecord.status       = 'transferred';
        currentRecord.leftAt       = Date.now();
        currentRecord.transferNote = transferNote || '';
        await currentRecord.save();

        // Drop active mandatory subject enrollments from old section
        // (will be re-enrolled for new section below)
        await SubjectEnrollment.updateMany(
            {
                student:        studentId,
                academicYear:   currentRecord.academicYear,
                enrollmentType: 'mandatory',
                status:         'active',
            },
            { $set: { status: 'dropped' } }
        );

        // ── Bucket enrollments: only drop the ones whose bucket name doesn't
        //    exist for the NEW section/grade. Buckets that are still valid
        //    (same bucket name offered in the new section) are preserved.
        const { gradeRangeFor } = require('./subjectController');
        const newGradeRange = gradeRangeFor(newSection.grade?.gradeNumber);

        const validBucketNames = await Subject.distinct('bucket', {
            isMandatory:  false,
            isActive:     true,
            bucket:       { $ne: null },
            academicYear: newSection.academicYear._id,
            $or: [
                { section: newSectionId },
                { grade:   newSection.grade._id },
                ...(newGradeRange ? [{ gradeRange: newGradeRange }] : []),
            ],
        });

        const activeBucketEnrollments = await SubjectEnrollment.find({
            student:        studentId,
            academicYear:   currentRecord.academicYear,
            enrollmentType: 'bucket',
            status:         'active',
        });

        let bucketsDropped = 0;
        for (const enr of activeBucketEnrollments) {
            if (!validBucketNames.includes(enr.bucket)) {
                enr.status = 'dropped';
                await enr.save();
                bucketsDropped++;
            }
                // else: bucket name still offered in new section — keep it active.
                // Note: the enrollment's `section` field will still point at the
            // old section; update it so it reflects the student's new section.
            else {
                enr.section = newSectionId;
                await enr.save();
            }
        }

        // Create new section assignment
        const newRecord = await StudentSection.create({
            student:      studentId,
            section:      newSectionId,
            grade:        newSection.grade._id,
            academicYear: newSection.academicYear._id,
            rollNumber:   '',
            status:       'active',
            promotedFrom: currentRecord._id,
        });

        // Sync User fields
        await syncUserFields(studentId, {
            gradeNumber: newSection.grade?.gradeNumber,
            sectionName: newSection.name,
            rollNumber:  '',
        });

        // Re-enroll in new section's mandatory subjects
        const { enrolled } = await autoEnrollMandatory({
            studentId,
            sectionId:      newSectionId,
            gradeId:        newSection.grade._id,
            gradeNumber:    newSection.grade?.gradeNumber,
            academicYearId: newSection.academicYear._id,
            semester:       newSection.academicYear.currentSemester || 1,
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
            mandatorySubjectsEnrolled: enrolled,
            bucketsCarriedOver: activeBucketEnrollments.length - bucketsDropped,
            bucketsDropped,
            message: `Student transferred to ${newSection.grade?.gradeNumber}${newSection.name}. ${enrolled} mandatory subject(s) re-enrolled. ${bucketsDropped > 0 ? `${bucketsDropped} bucket selection(s) dropped (not offered in new section) and need re-assignment.` : ''}`,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/student-sections/:id/withdraw ──────────────────────────────────
exports.withdrawStudent = async (req, res) => {
    try {
        const record = await StudentSection.findByIdAndUpdate(
            req.params.id,
            { $set: { status: 'withdrawn', leftAt: Date.now(), transferNote: req.body.reason || '' } },
            { new: true }
        ).populate('student', 'name email');

        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        // Drop all active subject enrollments for this academic year
        await SubjectEnrollment.updateMany(
            { student: record.student._id, academicYear: record.academicYear, status: 'active' },
            { $set: { status: 'dropped' } }
        );

        // Clear denormalized User fields
        await syncUserFields(record.student._id, { gradeNumber: null, sectionName: null, rollNumber: '' });

        res.status(200).json({ success: true, record, message: 'Student withdrawn and subject enrollments dropped' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/student-sections/:id/roll-number ───────────────────────────────
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

        await User.findByIdAndUpdate(record.student._id, { $set: { rollNumber } });

        res.status(200).json({ success: true, record });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/student-sections/my ────────────────────────────────────────────
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

// ─── GET /api/student-sections/my/current ────────────────────────────────────
exports.getMyCurrent = async (req, res) => {
    try {
        const record = await StudentSection.findOne({ student: req.user._id, status: 'active' })
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

        // Classmates
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

// ─── GET /api/student-sections ───────────────────────────────────────────────
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

// ─── POST /api/student-sections/promote ──────────────────────────────────────
// Promote all active students in a section to a new section for next year
exports.promoteStudents = async (req, res) => {
    try {
        const { fromSectionId, toSectionId, academicYearId } = req.body;

        const activeStudents = await StudentSection.find({ section: fromSectionId, status: 'active' });
        if (activeStudents.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No active students found in the source section',
            });
        }

        const toSection = await Section.findById(toSectionId)
            .populate('grade',        'gradeNumber name')
            .populate('academicYear', 'name currentSemester');
        if (!toSection) {
            return res.status(404).json({ success: false, message: 'Target section not found' });
        }

        const results = { promoted: 0, failed: 0, subjectsEnrolled: 0, errors: [] };

        for (const record of activeStudents) {
            try {
                // Mark old record as completed
                record.status = 'completed';
                record.leftAt = Date.now();
                await record.save();

                // Create new section assignment for next year
                await StudentSection.create({
                    student:      record.student,
                    section:      toSectionId,
                    grade:        toSection.grade._id,
                    academicYear: academicYearId,
                    rollNumber:   '',
                    status:       'active',
                    promotedFrom: record._id,
                });

                // Sync User fields
                await syncUserFields(record.student, {
                    gradeNumber: toSection.grade?.gradeNumber,
                    sectionName: toSection.name,
                    rollNumber:  '',
                });

                // Auto-enroll mandatory subjects for new year/grade
                const { enrolled } = await autoEnrollMandatory({
                    studentId:      record.student,
                    sectionId:      toSectionId,
                    gradeId:        toSection.grade._id,
                    gradeNumber:    toSection.grade?.gradeNumber,
                    academicYearId: academicYearId,
                    semester:       toSection.academicYear?.currentSemester || 1,
                });

                results.promoted++;
                results.subjectsEnrolled += enrolled;
            } catch (e) {
                results.failed++;
                results.errors.push({ student: record.student, error: e.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Promoted ${results.promoted} student(s). ${results.failed} failed. ${results.subjectsEnrolled} subject enrollments created.`,
            results,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};