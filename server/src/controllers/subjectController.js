const Subject           = require('../models/Subject');
const SubjectEnrollment = require('../models/SubjectEnrollment');

function gradeRangeFor(gradeNumber) {
    if (gradeNumber >= 1  && gradeNumber <= 5)  return '1-5';
    if (gradeNumber >= 6  && gradeNumber <= 9)  return '6-9';
    if (gradeNumber >= 10 && gradeNumber <= 11) return '10-11';
    if (gradeNumber >= 12 && gradeNumber <= 13) return '12-13';
    return null;
}
exports.gradeRangeFor = gradeRangeFor;

exports.getMandatorySubjectsForGrade = async (gradeNumber, academicYearId, gradeId) => {
    const range = gradeRangeFor(gradeNumber);
    return Subject.find({
        isMandatory: true,
        isActive:    true,
        $or: [
            { gradeRange: range },
            { grade: gradeId, academicYear: academicYearId },
        ],
    });
};

exports.getBucketsForSection = async (req, res) => {
    try {
        const { academicYear } = req.query;
        const { sectionId } = req.params;

        const Section = require('../models/Section');
        const section = await Section.findById(sectionId).populate('grade', 'gradeNumber');
        if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

        const range = gradeRangeFor(section.grade?.gradeNumber);
        const filter = {
            isMandatory: false,
            isActive:    true,
            bucket:      { $ne: null },
            $or: [
                { gradeRange: range },
                { grade: section.grade._id, academicYear },
            ],
        };

        const bucketNames = await Subject.distinct('bucket', filter);
        bucketNames.sort();

        res.status(200).json({ success: true, buckets: bucketNames });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subjects ────────────────────────────────────────────────────────
exports.getSubjects = async (req, res) => {
    try {
        const { grade, gradeRange, academicYear, semester, bucket, isMandatory } = req.query;
        const filter = {};

        if (gradeRange)   filter.gradeRange   = gradeRange;
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);
        if (bucket)       filter.bucket       = bucket;
        if (isMandatory !== undefined) filter.isMandatory = isMandatory === 'true';

        const subjects = await Subject.find(filter)
            .populate('grade',        'name gradeNumber stream')
            .populate('academicYear', 'name')
            .sort({ isMandatory: -1, bucket: 1, name: 1 });

        res.status(200).json({ success: true, subjects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSubjectsForGrade = async (req, res) => {
    try {
        const { gradeNumber, gradeId, academicYear } = req.query;
        const range = gradeNumber ? gradeRangeFor(Number(gradeNumber)) : null;

        const orClauses = [];
        if (range) orClauses.push({ gradeRange: range });
        if (gradeId) orClauses.push({ grade: gradeId, academicYear: academicYear || null });

        if (orClauses.length === 0) {
            return res.status(400).json({ success: false, message: 'gradeNumber or gradeId is required' });
        }

        const subjects = await Subject.find({ isActive: true, $or: orClauses })
            .populate('grade', 'name gradeNumber stream')
            .sort({ isMandatory: -1, bucket: 1, name: 1 });

        res.status(200).json({ success: true, subjects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getBucketSubjects = async (req, res) => {
    try {
        const { gradeRange, grade, academicYear } = req.query;
        const filter = { isMandatory: false, isActive: true, bucket: { $ne: null } };

        const orClauses = [];
        if (gradeRange) orClauses.push({ gradeRange });
        if (grade)       orClauses.push({ grade, academicYear: academicYear || null });
        if (orClauses.length > 0) filter.$or = orClauses;

        const subjects = await Subject.find(filter).sort({ bucket: 1, name: 1 });

        const grouped = subjects.reduce((acc, s) => {
            if (!acc[s.bucket]) acc[s.bucket] = [];
            acc[s.bucket].push(s);
            return acc;
        }, {});

        res.status(200).json({ success: true, grouped, subjects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id)
            .populate('grade',        'name gradeNumber stream')
            .populate('academicYear', 'name');

        if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
        res.status(200).json({ success: true, subject });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createSubject = async (req, res) => {
    try {
        const {
            name, code, scopeMode, gradeRange, grade, academicYear,
            isMandatory, bucket,
            credits, description, schedule, semester,
        } = req.body;

        if (scopeMode === 'range') {
            if (!gradeRange) {
                return res.status(400).json({ success: false, message: 'Grade range is required for range-mode subjects' });
            }
        } else if (scopeMode === 'specific') {
            if (!grade || !academicYear) {
                return res.status(400).json({ success: false, message: 'Grade and academic year are required for specific-grade subjects' });
            }
        } else {
            return res.status(400).json({ success: false, message: 'scopeMode must be "range" or "specific"' });
        }

        if (!isMandatory && !bucket) {
            return res.status(400).json({
                success: false,
                message: 'Non-mandatory subjects must have a bucket name (e.g. "scienceBucket", "ictBucket", "religion")',
            });
        }
        if (isMandatory && bucket) {
            return res.status(400).json({ success: false, message: 'Mandatory subjects cannot have a bucket' });
        }

        const subject = await Subject.create({
            name, code,
            gradeRange:   scopeMode === 'range'    ? gradeRange : null,
            grade:        scopeMode === 'specific' ? grade      : null,
            academicYear: scopeMode === 'specific' ? academicYear : null,
            isMandatory:  isMandatory !== false,
            bucket:       isMandatory ? null : bucket.trim(),
            credits, description, schedule,
            semester: semester || 1,
        });

        await subject.populate([
            { path: 'grade',        select: 'name gradeNumber stream' },
            { path: 'academicYear', select: 'name' },
        ]);

        res.status(201).json({ success: true, subject });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'A subject with this code already exists for this scope/semester' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

        // Teacher field no longer lives on Subject, so the old teacher-ownership
        // check is removed — teachers manage their own assignments via
        // SubjectTeacherAssignment, not by editing the Subject document.
        if (req.user.role === 'teacher') {
            return res.status(403).json({ success: false, message: 'Only admins can edit subject definitions' });
        }

        const { isMandatory, bucket, gradeRange, grade, academicYear, scopeMode, ...safeUpdate } = req.body;

        const updated = await Subject.findByIdAndUpdate(
            req.params.id,
            { $set: safeUpdate },
            { new: true, runValidators: true }
        ).populate('grade', 'name gradeNumber stream');

        res.status(200).json({ success: true, subject: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

        const enrollmentCount = await SubjectEnrollment.countDocuments({ subject: req.params.id, status: 'active' });
        if (enrollmentCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: ${enrollmentCount} student(s) currently enrolled in this subject`,
            });
        }

        // Clean up any teacher assignments for this subject too
        const SubjectTeacherAssignment = require('../models/SubjectTeacherAssignment');
        await SubjectTeacherAssignment.deleteMany({ subject: req.params.id });

        await subject.deleteOne();
        res.status(200).json({ success: true, message: 'Subject deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};