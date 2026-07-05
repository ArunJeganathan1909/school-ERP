const AcademicYear = require('../models/AcademicYear');
const Grade        = require('../models/Grade');
const Section      = require('../models/Section');

// GET /api/academic-years
exports.getAll = async (req, res) => {
    try {
        const years = await AcademicYear.find()
            .populate('createdBy', 'name email')
            .sort({ startDate: -1 });
        res.status(200).json({ success: true, years });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/academic-years/active
exports.getActive = async (req, res) => {
    try {
        const year = await AcademicYear.findOne({ isActive: true });
        if (!year) {
            return res.status(404).json({ success: false, message: 'No active academic year found' });
        }
        res.status(200).json({ success: true, year });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/academic-years/:id
exports.getOne = async (req, res) => {
    try {
        const year = await AcademicYear.findById(req.params.id)
            .populate('createdBy', 'name email');
        if (!year) {
            return res.status(404).json({ success: false, message: 'Academic year not found' });
        }
        res.status(200).json({ success: true, year });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/academic-years
exports.create = async (req, res) => {
    try {
        const {
            name, startDate, endDate, totalSemesters,
            currentSemester, semesterDates, description,
        } = req.body;

        const existing = await AcademicYear.findOne({ name });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Academic year "${name}" already exists`,
            });
        }

        const year = await AcademicYear.create({
            name, startDate, endDate,
            totalSemesters: totalSemesters || 3,
            currentSemester: currentSemester || 1,
            semesterDates:  semesterDates  || [],
            description,
            createdBy: req.user._id,
            isActive: false,  // must activate explicitly
        });

        res.status(201).json({ success: true, year });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/academic-years/:id
exports.update = async (req, res) => {
    try {
        // Don't allow changing isActive via this endpoint
        const { isActive, ...updateData } = req.body;

        const year = await AcademicYear.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!year) {
            return res.status(404).json({ success: false, message: 'Academic year not found' });
        }

        res.status(200).json({ success: true, year });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/academic-years/:id/activate
// Deactivates all others and activates this one
exports.activate = async (req, res) => {
    try {
        // Deactivate all
        await AcademicYear.updateMany({}, { $set: { isActive: false } });

        // Activate selected
        const year = await AcademicYear.findByIdAndUpdate(
            req.params.id,
            { $set: { isActive: true } },
            { new: true }
        );

        if (!year) {
            return res.status(404).json({ success: false, message: 'Academic year not found' });
        }

        res.status(200).json({ success: true, year, message: `"${year.name}" is now the active academic year` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/academic-years/:id/semester
// Advance or set the current semester
exports.setSemester = async (req, res) => {
    try {
        const { currentSemester } = req.body;

        const year = await AcademicYear.findById(req.params.id);
        if (!year) {
            return res.status(404).json({ success: false, message: 'Academic year not found' });
        }

        if (currentSemester > year.totalSemesters) {
            return res.status(400).json({
                success: false,
                message: `Semester ${currentSemester} exceeds total semesters (${year.totalSemesters})`,
            });
        }

        year.currentSemester = currentSemester;
        await year.save();

        // Also update all sections under this academic year
        await Section.updateMany(
            { academicYear: year._id },
            { $set: { currentSemester } }
        );

        res.status(200).json({
            success: true,
            year,
            message: `Current semester updated to ${currentSemester} for all sections`,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/academic-years/:id
exports.remove = async (req, res) => {
    try {
        const year = await AcademicYear.findById(req.params.id);
        if (!year) {
            return res.status(404).json({ success: false, message: 'Academic year not found' });
        }
        if (year.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete the active academic year',
            });
        }

        // Check for grades
        const gradeCount = await Grade.countDocuments({ academicYear: req.params.id });
        if (gradeCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: ${gradeCount} grade(s) exist under this year`,
            });
        }

        await year.deleteOne();
        res.status(200).json({ success: true, message: 'Academic year deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};