const TimetableStructure = require('../models/TimetableStructure');
const Timetable          = require('../models/Timetable');

// GET /api/timetable-structures?academicYear=&semester=
exports.getAll = async (req, res) => {
    try {
        const { academicYear, semester } = req.query;
        const filter = {};
        if (academicYear) filter.academicYear = academicYear;
        if (semester)     filter.semester     = Number(semester);

        const structures = await TimetableStructure.find(filter)
            .populate('academicYear', 'name currentSemester totalSemesters')
            .populate('createdBy',    'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, structures });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/timetable-structures/:id
exports.getOne = async (req, res) => {
    try {
        const structure = await TimetableStructure.findById(req.params.id)
            .populate('academicYear', 'name currentSemester')
            .populate('createdBy',    'name email');

        if (!structure) {
            return res.status(404).json({ success: false, message: 'Structure not found' });
        }

        // How many timetables use this structure
        const timetableCount = await Timetable.countDocuments({ structureRef: req.params.id });

        res.status(200).json({ success: true, structure, timetableCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/timetable-structures
exports.create = async (req, res) => {
    try {
        const { academicYear, semester, name, workingDays, periods } = req.body;

        // Validate period numbers are unique
        const nums = periods.map((p) => p.number);
        if (new Set(nums).size !== nums.length) {
            return res.status(400).json({
                success: false,
                message: 'Period numbers must be unique',
            });
        }

        const structure = await TimetableStructure.create({
            academicYear,
            semester:    semester || 1,
            name:        name || '',
            workingDays: workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday'],
            periods,
            createdBy:   req.user._id,
        });

        await structure.populate('academicYear', 'name currentSemester');

        res.status(201).json({ success: true, structure });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A timetable structure already exists for this academic year and semester',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/timetable-structures/:id
exports.update = async (req, res) => {
    try {
        const { name, workingDays, periods, isActive } = req.body;
        const update = {};
        if (name        !== undefined) update.name        = name;
        if (workingDays !== undefined) update.workingDays = workingDays;
        if (periods     !== undefined) update.periods     = periods;
        if (isActive    !== undefined) update.isActive    = isActive;

        const structure = await TimetableStructure.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        ).populate('academicYear', 'name');

        if (!structure) {
            return res.status(404).json({ success: false, message: 'Structure not found' });
        }

        res.status(200).json({ success: true, structure });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/timetable-structures/:id
exports.remove = async (req, res) => {
    try {
        const count = await Timetable.countDocuments({ structureRef: req.params.id });
        if (count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: ${count} timetable(s) are using this structure`,
            });
        }

        const structure = await TimetableStructure.findByIdAndDelete(req.params.id);
        if (!structure) {
            return res.status(404).json({ success: false, message: 'Structure not found' });
        }

        res.status(200).json({ success: true, message: 'Structure deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};