const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

// GET /api/courses
exports.getAllCourses = async (req, res) => {
    try {
        const { status, department, search, page = 1, limit = 12 } = req.query;

        const filter = {};

        if (status) filter.status = status;
        if (department) filter.department = department;

        // Use regex search instead of $text to avoid needing a text index
        if (search && search.trim()) {
            filter.$or = [
                { title:       { $regex: search.trim(), $options: 'i' } },
                { code:        { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } },
                { department:  { $regex: search.trim(), $options: 'i' } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [courses, total] = await Promise.all([
            Course.find(filter)
                .populate('enrolledCount')
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 }),
            Course.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            courses,
        });
    } catch (err) {
        console.error('getAllCourses error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/courses/:id
exports.getCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('enrolledCount');

        if (!course) return res.status(404).json({
            success: false,
            message: 'Course not found',
        })

        res.status(200).json({
            success: true,
            course,
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// POST /api/courses — admin only
exports.createCourse = async (req, res) => {
    try {
        const { title, code, description, department, duration, maxStudents, tags, status } = req.body;

        const existing = await Course.findOne({ code: code?.toUpperCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Course code already exists' });
        }

        const course = await Course.create({
            title,
            code,
            description,
            department,
            duration,
            maxStudents,
            tags,
            status: status || 'active',
        });

        res.status(201).json({ success: true, course });
    } catch (err) {
        console.error('createCourse error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/courses/:id — admin only
exports.updateCourse = async (req, res) => {
    try {
        // Strip any teacher field if accidentally sent from old frontend
        const { teacher, ...updateData } = req.body;

        const course = await Course.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        res.status(200).json({ success: true, course });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/courses/:id - admin only
exports.deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({
            success: false,
            message: 'Course not found'
        });

        // Check active enrollments
        const activeCount = await Enrollment.countDocuments({ course: req.params.id, status: 'active' });
        if (activeCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: ${activeCount} students currently enrolled`,
            });
        }

        await course.deleteOne();
        res.status(200).json({ success: true, message: 'Course deleted' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// GET /api/courses/departments - unique department list
exports.getDepartments = async (req, res) => {
    try {
        const departments = await Course.distinct('department');
        res.status(200).json({
            success: true,
            departments
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}