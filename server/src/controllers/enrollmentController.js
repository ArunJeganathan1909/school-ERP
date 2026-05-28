const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const { notify } = require('../socket/socketHelpers');

// POST /api/enrollments/enroll — student enrolls themselves
exports.enroll = async (req, res) => {
    try {
        const { courseId } = req.body;

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        if (course.status !== 'active') return res.status(400).json({ success: false, message: 'Course is not active' });

        // Check max capacity
        const enrolledCount = await Enrollment.countDocuments({ course: courseId, status: 'active' });
        if (enrolledCount >= course.maxStudents) {
            return res.status(400).json({ success: false, message: 'Course is at full capacity' });
        }

        // Check already enrolled
        const existing = await Enrollment.findOne({ student: req.user._id, course: courseId });
        if (existing) {
            if (existing.status === 'active') return res.status(400).json({ success: false, message: 'Already enrolled' });
            // Re-activate if dropped
            existing.status = 'active';
            existing.enrolledAt = Date.now();
            await existing.save();
            return res.status(200).json({ success: true, enrollment: existing, message: 'Re-enrolled successfully' });
        }

        const enrollment = await Enrollment.create({
            student: req.user._id,
            course: courseId,
        });

        await enrollment.populate([
            { path: 'course', select: 'title code department' },
            { path: 'student', select: 'name email' },
        ]);

        res.status(201).json({ success: true, enrollment });
        await notify({
            recipientId: req.user._id,
            type: 'enrollment',
            title: 'Enrollment confirmed',
            message: `You have successfully enrolled in "${course.title}".`,
            link: `/courses/${course._id}`,
        });
        
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/enrollments/:id/drop — student drops course
exports.dropCourse = async (req, res) => {
    try {
        const enrollment = await Enrollment.findById(req.params.id);
        if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });

        if (String(enrollment.student) !== String(req.user._id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        enrollment.status = 'dropped';
        await enrollment.save();

        res.status(200).json({ success: true, message: 'Course dropped successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/enrollments/my — student's own enrollments
exports.getMyEnrollments = async (req, res) => {
    try {
        const enrollments = await Enrollment.find({ student: req.user._id })
            .populate('course', 'title code department teacher thumbnail status')
            .populate({ path: 'course', populate: { path: 'teacher', select: 'name' } })
            .sort({ enrolledAt: -1 });

        res.status(200).json({ success: true, enrollments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/enrollments/course/:courseId — admin or teacher: all students in a course
exports.getCourseEnrollments = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { course: req.params.courseId };
        if (status) filter.status = status;

        const enrollments = await Enrollment.find(filter)
            .populate('student', 'name email phone profilePhoto')
            .sort({ enrolledAt: -1 });

        res.status(200).json({ success: true, enrollments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/enrollments/:id/grade — teacher or admin assigns grade
exports.assignGrade = async (req, res) => {
    try {
        const { grade, gradePoints, remarks } = req.body;

        const enrollment = await Enrollment.findByIdAndUpdate(
            req.params.id,
            { $set: { grade, gradePoints, remarks, status: 'completed', completedAt: Date.now() } },
            { new: true }
        ).populate('student', 'name email').populate('course', 'title');

        if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });

        res.status(200).json({ success: true, enrollment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/enrollments — admin: all enrollments with filters
exports.getAllEnrollments = async (req, res) => {
    try {
        const { course, student, status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (course) filter.course = course;
        if (student) filter.student = student;
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const [enrollments, total] = await Promise.all([
            Enrollment.find(filter)
                .populate('student', 'name email')
                .populate('course', 'title code')
                .skip(skip)
                .limit(Number(limit))
                .sort({ enrolledAt: -1 }),
            Enrollment.countDocuments(filter),
        ]);

        res.status(200).json({ success: true, total, enrollments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};