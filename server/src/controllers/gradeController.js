const Grade         = require('../models/Grade');
const Section       = require('../models/Section');
const AcademicYear  = require('../models/AcademicYear');

// GET /api/grades?academicYear=id
exports.getAll = async (req, res) => {
    try {
        const { academicYear, stream, isActive } = req.query;
        const filter = {};
        if (academicYear) filter.academicYear = academicYear;
        if (stream)       filter.stream       = stream;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const grades = await Grade.find(filter)
            .populate('academicYear', 'name currentSemester isActive')
            .populate('createdBy', 'name')
            .sort({ gradeNumber: 1 });

        res.status(200).json({ success: true, grades });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/grades/:id
exports.getOne = async (req, res) => {
    try {
        const grade = await Grade.findById(req.params.id)
            .populate('academicYear', 'name currentSemester totalSemesters isActive')
            .populate('createdBy', 'name email');

        if (!grade) {
            return res.status(404).json({ success: false, message: 'Grade not found' });
        }

        // Also return section count
        const sectionCount = await Section.countDocuments({ grade: req.params.id });

        res.status(200).json({ success: true, grade, sectionCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/grades
exports.create = async (req, res) => {
    try {
        const { academicYear, gradeNumber, name, stream, description } = req.body;

        // Validate academic year exists
        const year = await AcademicYear.findById(academicYear);
        if (!year) {
            return res.status(404).json({ success: false, message: 'Academic year not found' });
        }

        const grade = await Grade.create({
            academicYear,
            gradeNumber,
            name: name || `Grade ${gradeNumber}`,
            stream: stream || 'none',
            description,
            createdBy: req.user._id,
        });

        await grade.populate('academicYear', 'name currentSemester');

        res.status(201).json({ success: true, grade });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This grade already exists for the selected academic year and stream',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/grades/:id
exports.update = async (req, res) => {
    try {
        const grade = await Grade.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate('academicYear', 'name currentSemester');

        if (!grade) {
            return res.status(404).json({ success: false, message: 'Grade not found' });
        }

        res.status(200).json({ success: true, grade });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/grades/:id
exports.remove = async (req, res) => {
    try {
        const grade = await Grade.findById(req.params.id);
        if (!grade) {
            return res.status(404).json({ success: false, message: 'Grade not found' });
        }

        const sectionCount = await Section.countDocuments({ grade: req.params.id });
        if (sectionCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: ${sectionCount} section(s) exist under this grade`,
            });
        }

        await grade.deleteOne();
        res.status(200).json({ success: true, message: 'Grade deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};