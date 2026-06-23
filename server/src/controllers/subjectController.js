const Subject = require('../models/Subject');
const SubjectEnrollment = require('../models/SubjectEnrollment');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeRangeFor(gradeNumber) {
    if (gradeNumber >= 1  && gradeNumber <= 5)  return '1-5';
    if (gradeNumber >= 6  && gradeNumber <= 9)  return '6-9';
    if (gradeNumber >= 10 && gradeNumber <= 11) return '10-11';
    if (gradeNumber >= 12 && gradeNumber <= 13) return '12-13';
    return null;
}
exports.gradeRangeFor = gradeRangeFor;

/**
 * Returns mandatory subjects for a student, combining:
 *   - Mode A: subjects matching the student's gradeRange (year-independent)
 *   - Mode B: subjects matching the student's specific Grade document
 */
exports.getMandatorySubjectsForGrade = async (gradeNumber, academicYearId, gradeId) => {
    const range = gradeRangeFor(gradeNumber);
    return Subject.find({
        isMandatory: true,
        isActive:    true,
        $or: [
            { gradeRange: range },                          // Mode A — year-independent
            { grade: gradeId, academicYear: academicYearId }, // Mode B — year-scoped
        ],
    });
};

/**
 * GET /api/subjects/buckets-for-section/:sectionId?academicYear=
 */
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
        const { grade, gradeRange, academicYear, semester, teacher, bucket, isMandatory } = req.query;
        const filter = {};

        if (gradeRange)   filter.gradeRange   = gradeRange;
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);
        if (teacher)      filter.teacher      = teacher;
        if (bucket)        filter.bucket       = bucket;
        if (isMandatory !== undefined) filter.isMandatory = isMandatory === 'true';

        const subjects = await Subject.find(filter)
            .populate('section',      'name')
            .populate('grade',        'name gradeNumber stream')
            .populate('academicYear', 'name')
            .populate('teacher',      'name email')
            .sort({ isMandatory: -1, bucket: 1, name: 1 });

        res.status(200).json({ success: true, subjects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/subjects/for-grade?gradeNumber=&gradeId=&academicYear=
 * Convenience endpoint: returns ALL subjects (mandatory + bucket) relevant
 * to a student given their grade number (Mode A matches) and/or specific
 * Grade document id (Mode B matches, e.g. for A/L stream students).
 */
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
            .populate('teacher', 'name email')
            .populate('grade', 'name gradeNumber stream')
            .sort({ isMandatory: -1, bucket: 1, name: 1 });

        res.status(200).json({ success: true, subjects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subjects/buckets?gradeRange=&grade=&academicYear= ──────────────
exports.getBucketSubjects = async (req, res) => {
    try {
        const { gradeRange, grade, academicYear } = req.query;
        const filter = { isMandatory: false, isActive: true, bucket: { $ne: null } };

        const orClauses = [];
        if (gradeRange) orClauses.push({ gradeRange });
        if (grade)       orClauses.push({ grade, academicYear: academicYear || null });
        if (orClauses.length > 0) filter.$or = orClauses;

        const subjects = await Subject.find(filter)
            .populate('teacher', 'name email')
            .sort({ bucket: 1, name: 1 });

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

// ─── GET /api/subjects/:id ────────────────────────────────────────────────────
exports.getSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id)
            .populate('section',      'name')
            .populate('grade',        'name gradeNumber stream')
            .populate('academicYear', 'name')
            .populate('teacher',      'name email profilePhoto');

        if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
        res.status(200).json({ success: true, subject });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── POST /api/subjects ───────────────────────────────────────────────────────
exports.createSubject = async (req, res) => {
    try {
        const {
            name, code, scopeMode, gradeRange, grade, academicYear,
            isMandatory, bucket,
            teacher, credits, description, schedule, semester,
        } = req.body;

        // Validate scope mode explicitly at the API layer (clearer error than
        // relying solely on the Mongoose pre-validate hook)
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
            teacher, credits, description, schedule,
            semester: semester || 1,
        });

        await subject.populate([
            { path: 'grade',        select: 'name gradeNumber stream' },
            { path: 'academicYear', select: 'name' },
            { path: 'teacher',      select: 'name email' },
        ]);

        res.status(201).json({ success: true, subject });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'A subject with this code already exists for this scope/semester' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/subjects/:id ────────────────────────────────────────────────────
exports.updateSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

        if (req.user.role === 'teacher' && String(subject.teacher) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Don't allow changing scope mode or mandatory/bucket type after creation
        // (changing scope mode would orphan existing SubjectEnrollment records)
        const { isMandatory, bucket, gradeRange, grade, academicYear, scopeMode, ...safeUpdate } = req.body;

        const updated = await Subject.findByIdAndUpdate(
            req.params.id,
            { $set: safeUpdate },
            { new: true, runValidators: true }
        ).populate([
            { path: 'grade',   select: 'name gradeNumber stream' },
            { path: 'teacher', select: 'name email' },
        ]);

        res.status(200).json({ success: true, subject: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── DELETE /api/subjects/:id ─────────────────────────────────────────────────
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

        await subject.deleteOne();
        res.status(200).json({ success: true, message: 'Subject deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};