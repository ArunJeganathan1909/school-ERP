const Subject           = require('../models/Subject');
const SubjectEnrollment = require('../models/SubjectEnrollment');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a gradeNumber (1–13) to its range string.
 * Used to find mandatory subjects that apply to a grade automatically.
 */
function gradeRangeFor(gradeNumber) {
    if (gradeNumber >= 1  && gradeNumber <= 5)  return '1-5';
    if (gradeNumber >= 6  && gradeNumber <= 9)  return '6-9';
    if (gradeNumber >= 10 && gradeNumber <= 11) return '10-11';
    if (gradeNumber >= 12 && gradeNumber <= 13) return '12-13';
    return null;
}

// Export helper so studentSectionController can use it
exports.gradeRangeFor = gradeRangeFor;

/**
 * Get all mandatory subjects that apply to a given gradeNumber + academicYear.
 * Combines:
 *   1. Grade-range-wide mandatory subjects (e.g. all grade 6-9 students do Maths)
 *   2. Section-specific mandatory subjects
 */
exports.getMandatorySubjectsForGrade = async (gradeNumber, academicYearId, sectionId) => {
    const range = gradeRangeFor(gradeNumber);

    const query = {
        isMandatory: true,
        isActive:    true,
        academicYear: academicYearId,
        $or: [
            { gradeRange: range },          // grade-range-wide mandatory subjects
            { section: sectionId },         // section-specific mandatory subjects
        ],
    };

    return Subject.find(query);
};

// ─── GET /api/subjects ────────────────────────────────────────────────────────
exports.getSubjects = async (req, res) => {
    try {
        const { section, grade, academicYear, semester, teacher, bucket, isMandatory } = req.query;
        const filter = {};

        if (section)      filter.section      = section;
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);
        if (teacher)      filter.teacher      = teacher;
        if (bucket)       filter.bucket       = bucket;
        if (isMandatory !== undefined) filter.isMandatory = isMandatory === 'true';

        const subjects = await Subject.find(filter)
            .populate('section',      'name')
            .populate('grade',        'name gradeNumber')
            .populate('academicYear', 'name')
            .populate('teacher',      'name email')
            .sort({ isMandatory: -1, bucket: 1, name: 1 });
        // Mandatory first, then buckets alphabetically

        res.status(200).json({ success: true, subjects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /api/subjects/buckets?grade=id&academicYear=id ──────────────────────
// Returns all bucket subjects grouped by bucket name — useful for admin UI
exports.getBucketSubjects = async (req, res) => {
    try {
        const { grade, academicYear, section } = req.query;
        const filter = {
            isMandatory: false,
            isActive:    true,
            bucket:      { $ne: null },
        };
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (section)      filter.section      = section;

        const subjects = await Subject.find(filter)
            .populate('teacher', 'name email')
            .sort({ bucket: 1, name: 1 });

        // Group by bucket
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
            .populate('grade',        'name gradeNumber')
            .populate('academicYear', 'name')
            .populate('teacher',      'name email profilePhoto');

        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }
        res.status(200).json({ success: true, subject });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── POST /api/subjects — admin only ─────────────────────────────────────────
/**
 * Creating a subject:
 *
 * Mandatory subject examples:
 *   { name: 'Mathematics', code: 'MATH', isMandatory: true, gradeRange: '6-9',
 *     academicYear: id, grade: id, section: id }
 *
 * Bucket subject examples:
 *   { name: 'Art', code: 'ART', isMandatory: false, bucket: 'bucket1',
 *     grade: id, section: id, academicYear: id }
 */
exports.createSubject = async (req, res) => {
    try {
        const {
            name, code, section, grade, academicYear,
            isMandatory, bucket, gradeRange,
            teacher, credits, description, schedule, semester,
        } = req.body;

        // Validate bucket logic
        if (!isMandatory && !bucket) {
            return res.status(400).json({
                success: false,
                message: 'Non-mandatory subjects must belong to a bucket (bucket1, religion, firstLang, secondLang)',
            });
        }
        if (isMandatory && bucket) {
            return res.status(400).json({
                success: false,
                message: 'Mandatory subjects cannot have a bucket',
            });
        }

        const subject = await Subject.create({
            name, code, section, grade, academicYear,
            isMandatory: isMandatory !== false, // default true
            bucket:      isMandatory ? null : bucket,
            gradeRange:  isMandatory ? (gradeRange || null) : null,
            teacher, credits, description, schedule,
            semester: semester || 1,
        });

        await subject.populate([
            { path: 'section',      select: 'name' },
            { path: 'grade',        select: 'name gradeNumber' },
            { path: 'academicYear', select: 'name' },
            { path: 'teacher',      select: 'name email' },
        ]);

        res.status(201).json({ success: true, subject });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A subject with this code already exists in this section/semester',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /api/subjects/:id — admin or assigned teacher ───────────────────────
exports.updateSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }

        if (req.user.role === 'teacher' && String(subject.teacher) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Don't allow changing mandatory/bucket type after creation (would break enrollments)
        const { isMandatory, bucket, ...safeUpdate } = req.body;

        const updated = await Subject.findByIdAndUpdate(
            req.params.id,
            { $set: safeUpdate },
            { new: true, runValidators: true }
        ).populate([
            { path: 'section',      select: 'name' },
            { path: 'grade',        select: 'name gradeNumber' },
            { path: 'teacher',      select: 'name email' },
        ]);

        res.status(200).json({ success: true, subject: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── DELETE /api/subjects/:id — admin only ────────────────────────────────────
exports.deleteSubject = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }

        // Block deletion if active enrollments exist
        const enrollmentCount = await SubjectEnrollment.countDocuments({
            subject: req.params.id,
            status:  'active',
        });
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