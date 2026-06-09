const Attendance = require('../models/Attendance');
const Enrollment = require('../models/Enrollment');

// POST /api/attendance/mark - teacher marks a full class session
exports.markAttendance = async (req, res) => {
    try {
        const { subjectId, courseId, date, records, sessionType} = req.body;
        //     records = [{ studentId, status, remarks }]

        const attendanceData = new Date(date);

        const ops = records.map(({ studentId, status, remarks }) => ({
            updateOne: {
                filter: {
                    student: studentId,
                    subject: subjectId,
                    date: attendanceData
                },
                update: {
                    $set: {
                        student: studentId,
                        subject: subjectId,
                        course: courseId,
                        date: attendanceData,
                        status: status || 'present',
                        remarks: remarks || '',
                        sessionType: sessionType || 'lecture',
                        markedBy: req.user._id,
                    },
                },
                upsert: true,
            },
        }));

        const result = await Attendance.bulkWrite(ops);

        res.status(200).json({
            success: true,
            message: `Attendance marked for ${records.length} students.`,
            result,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
};

// GET /api/attendance?subjectId=&date= — teacher: get attendance for a session
exports.getSessionAttendance = async (req, res) => {
    try {
        const { subjectId, courseId, date } = req.query;

        const filter = {};
        if (subjectId) filter.subject = subjectId;
        if (courseId) filter.course = courseId;
        if (date) {
            const d = new Date(date);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            filter.date = { $gte: d, $lt: next };
        }

        const records = await Attendance.find(filter)
            .populate('student', 'name email profilePhoto')
            .populate('subject', 'name code')
            .sort({ 'student.name': 1 });

        res.status(200).json({
            success: true,
            records,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
};

// GET /api/attendance/student/:studentId — full attendance for a student
exports.getStudentAttendance = async (req, res) => {
    try {
        const { courseId, subjectId, from, to } = req.query;
        const studentId = req.params.studentId;

        //     Students can only see their own
        if (req.user.role === 'student' && String(req.user._id) !== String(studentId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            })
        }

        const filter = { student: studentId };
        if (courseId) filter.course = courseId;
        if (subjectId) filter.subject = subjectId;
        if (from || to ) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }

        const records = await Attendance.find(filter)
            .populate('subject', 'name code')
            .populate('course', 'title code')
            .sort({ date: -1 });

        //     Calculate summary per subject
        const summary = {};
        records.forEach((r) => {
            const key = String(r.subject?._id);
            if (!summary[key]){
                summary[key] = {
                    subject: r.subject,
                    total: 0,
                    present: 0,
                    absent: 0,
                    late: 0,
                    excused: 0,
                };
            }
            summary[key].total++;
            summary[key][r.status]++;
        });

        const  summaryArr = Object.values(summary).map((s) => ({
            ...s,
            percentage: s.total > 0 ? Math.round((s.present + s.late) / s.total * 100) : 0,
        }));

        res.status(200).json({
            success: true,
            records,
            summary: summaryArr
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// GET /api/attendance/report?courseId=&from=&to= — admin/teacher: full course report
exports.getCourseReport = async (req, res) => {
    try {
        const { courseId, from, to } = req.query;

        const filter ={};
        if (courseId) filter.course = courseId;
        if (from || to ) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }

        const records = await Attendance.find(filter)
            .populate('student', 'name email')
            .populate('subject', 'name code');

        //     Group by student
        const byStudent = {};
        records.forEach((r) => {
            const sid = String(r.student?._id);
            if (!byStudent[sid]) {
                byStudent[sid] = {
                    student: r.student,
                    total: 0,
                    present: 0,
                    absent: 0,
                    late: 0,
                    excused: 0,
                };
            }
            byStudent[sid].total++;
            byStudent[sid][r.status]++;
        });

        const report = Object.values(byStudent).map((s) => ({
            ...s,
            percentage: s.total > 0 ? Math.round((s.present + s.late) / s.total * 100) : 0,
        })).sort((a, b) => b.percentage - a.percentage);

        res.status(200).json({
            success: true,
            report
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}


// GET /api/attendance/my — shortcut: student's own attendance
exports.getMyAttendance = async (req, res) => {
    req.params.studentId = String(req.user._id);
    return exports.getStudentAttendance(req, res);
}

// GET /api/attendances/enrolled-students?subjectId=&date= — teacher: get students
// enrolled in the course that owns this subject, with existing attendance pre-loaded
exports.getEnrolledStudentsBySubject = async (req, res) => {
    try {
        const { subjectId, date } = req.query;

        if (!subjectId) {
            return res.status(400).json({ success: false, message: 'subjectId is required' });
        }

        const Subject    = require('../models/Subject');
        const Enrollment = require('../models/Enrollment');

        // 1. Find the subject to get its course
        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }

        // 2. Find all active enrollments for that course
        const enrollments = await Enrollment.find({
            course: subject.course,
            status: 'active',
        }).populate('student', 'name email profilePhoto');

        const students = enrollments.map(e => e.student);

        // 3. If a date is provided, also return existing attendance records for that day
        let existingRecords = [];
        if (date) {
            const d    = new Date(date);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);

            existingRecords = await Attendance.find({
                subject: subjectId,
                date: { $gte: d, $lt: next },
            }).lean();
        }

        // Build a map: studentId → attendance record
        const recordMap = {};
        existingRecords.forEach(r => {
            recordMap[String(r.student)] = r;
        });

        res.status(200).json({
            success:         true,
            courseId:        subject.course,
            students,
            existingRecords: recordMap,
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};