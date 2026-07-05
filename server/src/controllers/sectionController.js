const Section        = require('../models/Section');
const Grade          = require('../models/Grade');
const StudentSection = require('../models/StudentSection');
const Subject        = require('../models/Subject');
const Timetable      = require('../models/Timetable');

// GET /api/sections?grade=id&academicYear=id
exports.getAll = async (req, res) => {
    try {
        const { grade, academicYear, classTeacher, isActive } = req.query;
        const filter = {};
        if (grade)        filter.grade        = grade;
        if (academicYear) filter.academicYear = academicYear;
        if (classTeacher) filter.classTeacher = classTeacher;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const sections = await Section.find(filter)
            .populate('grade',        'name gradeNumber stream')
            .populate('academicYear', 'name currentSemester')
            .populate('classTeacher', 'name email profilePhoto')
            .populate('studentCount')
            .sort({ 'grade.gradeNumber': 1, name: 1 });

        // Attach displayName manually after populate
        const withDisplay = sections.map((s) => {
            const obj = s.toObject({ virtuals: true });
            obj.displayName = `${s.grade?.gradeNumber || ''}${s.name}`;
            return obj;
        });

        res.status(200).json({ success: true, sections: withDisplay });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/sections/:id
exports.getOne = async (req, res) => {
    try {
        const section = await Section.findById(req.params.id)
            .populate('grade',        'name gradeNumber stream')
            .populate('academicYear', 'name currentSemester totalSemesters')
            .populate('classTeacher', 'name email phone profilePhoto');

        if (!section) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        const [studentCount, subjectCount] = await Promise.all([
            StudentSection.countDocuments({ section: req.params.id, status: 'active' }),
            Subject.countDocuments({ section: req.params.id }),
        ]);

        const obj = section.toObject({ virtuals: true });
        obj.displayName  = `${section.grade?.gradeNumber || ''}${section.name}`;
        obj.studentCount = studentCount;
        obj.subjectCount = subjectCount;

        res.status(200).json({ success: true, section: obj });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/sections
exports.create = async (req, res) => {
    try {
        const { grade, academicYear, name, classTeacher, capacity, room } = req.body;

        // Validate grade belongs to the academic year
        const gradeDoc = await Grade.findById(grade);
        if (!gradeDoc) {
            return res.status(404).json({ success: false, message: 'Grade not found' });
        }
        if (String(gradeDoc.academicYear) !== String(academicYear)) {
            return res.status(400).json({
                success: false,
                message: 'Grade does not belong to the selected academic year',
            });
        }

        const section = await Section.create({
            grade,
            academicYear,
            name: name.toUpperCase(),
            classTeacher: classTeacher || null,
            capacity: capacity || 40,
            room: room || '',
        });

        await section.populate([
            { path: 'grade',        select: 'name gradeNumber' },
            { path: 'academicYear', select: 'name currentSemester' },
            { path: 'classTeacher', select: 'name email' },
        ]);

        const obj = section.toObject({ virtuals: true });
        obj.displayName = `${section.grade?.gradeNumber || ''}${section.name}`;

        res.status(201).json({ success: true, section: obj });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A section with this name already exists in this grade',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/sections/:id
exports.update = async (req, res) => {
    try {
        const section = await Section.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate([
            { path: 'grade',        select: 'name gradeNumber' },
            { path: 'academicYear', select: 'name currentSemester' },
            { path: 'classTeacher', select: 'name email' },
        ]);

        if (!section) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        const obj = section.toObject({ virtuals: true });
        obj.displayName = `${section.grade?.gradeNumber || ''}${section.name}`;

        res.status(200).json({ success: true, section: obj });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/sections/:id
exports.remove = async (req, res) => {
    try {
        const section = await Section.findById(req.params.id);
        if (!section) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        const activeStudents = await StudentSection.countDocuments({
            section: req.params.id,
            status:  'active',
        });
        if (activeStudents > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: ${activeStudents} active student(s) in this section`,
            });
        }

        // Clean up subjects and timetables for this section
        await Promise.all([
            Subject.deleteMany({ section: req.params.id }),
            Timetable.deleteMany({ section: req.params.id }),
            StudentSection.deleteMany({ section: req.params.id }),
        ]);

        await section.deleteOne();
        res.status(200).json({ success: true, message: 'Section and related data deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/sections/:id/students
exports.getSectionStudents = async (req, res) => {
    try {
        const { status = 'active' } = req.query;

        const records = await StudentSection.find({
            section: req.params.id,
            status,
        })
            .populate('student', 'name email phone profilePhoto currentGrade currentSection rollNumber admissionNumber gender')
            .sort({ rollNumber: 1 });

        res.status(200).json({ success: true, students: records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};