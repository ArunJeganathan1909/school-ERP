const mongoose        = require('mongoose');
const User             = require('../models/User');
const Subject          = require('../models/Subject');
const SubjectEnrollment = require('../models/SubjectEnrollment');
const Attendance       = require('../models/Attendance');
const Assignment       = require('../models/Assignment');
const Submission       = require('../models/Submission');
const Quiz             = require('../models/Quiz');
const Fee              = require('../models/Fee');
const PDFDocument      = require('pdfkit');
const { addHeader, addTable, addStatRow } = require('../utils/pdfGenerator');

// ─── ADMIN: master dashboard stats ──────────────────────────────────────────
exports.getAdminDashboard = async (req, res) => {
    try {
        const [
            totalStudents, totalTeachers, totalSubjects,
            activeEnrollments, feeStats, attendanceSummary,
            monthlyEnrollments, submissionsGraded,
        ] = await Promise.all([
            User.countDocuments({ role: 'student', isActive: true }),
            User.countDocuments({ role: 'teacher', isActive: true }),
            Subject.countDocuments({ isActive: true }),
            SubjectEnrollment.countDocuments({ status: 'active' }),

            // Fee aggregation
            Fee.aggregate([
                { $group: {
                        _id: null,
                        totalExpected: { $sum: '$netAmount' },
                        totalCollected: { $sum: '$paidAmount' },
                        overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
                    }},
            ]),

            // Overall attendance rate (last 30 days)
            Attendance.aggregate([
                { $match: { date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
                { $group: {
                        _id: null,
                        total: { $sum: 1 },
                        present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
                    }},
            ]),

            // Monthly enrollment trend (last 6 months) — SubjectEnrollment has
            // no `enrolledAt`, so we use its `createdAt` timestamp instead.
            SubjectEnrollment.aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 180 * 86400000) } } },
                { $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        count: { $sum: 1 },
                    }},
                { $sort: { '_id.year': 1, '_id.month': 1 } },
            ]),

            // Submission grading rate
            Submission.aggregate([
                { $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    }},
            ]),
        ]);

        const fees = feeStats[0] || { totalExpected: 0, totalCollected: 0, overdue: 0 };
        const att = attendanceSummary[0] || { total: 0, present: 0 };
        const attendanceRate = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;

        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const enrollmentTrend = monthlyEnrollments.map((e) => ({
            month: `${MONTHS[e._id.month - 1]} ${e._id.year}`,
            count: e.count,
        }));

        const submissionMap = {};
        submissionsGraded.forEach((s) => { submissionMap[s._id] = s.count; });

        res.status(200).json({
            success: true,
            stats: {
                totalStudents,
                totalTeachers,
                totalSubjects,
                activeEnrollments,
                attendanceRate,
                feeCollectionRate: fees.totalExpected > 0
                    ? Math.round((fees.totalCollected / fees.totalExpected) * 100) : 0,
                totalExpected: fees.totalExpected,
                totalCollected: fees.totalCollected,
                overdueInvoices: fees.overdue,
                submittedAssignments: submissionMap['submitted'] || 0,
                gradedAssignments: submissionMap['graded'] || 0,
            },
            enrollmentTrend,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── ADMIN: per-subject analytics ────────────────────────────────────────────
exports.getSubjectAnalytics = async (req, res) => {
    try {
        const subjects = await Subject.find({ isActive: true }).lean();
        const subjectIds = subjects.map((s) => s._id);

        const [enrollmentCounts, attendanceRates, submissionRates] = await Promise.all([
            SubjectEnrollment.aggregate([
                { $match: { subject: { $in: subjectIds }, status: 'active' } },
                { $group: { _id: '$subject', count: { $sum: 1 } } },
            ]),

            Attendance.aggregate([
                { $match: { subject: { $in: subjectIds }, date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
                { $group: {
                        _id: '$subject',
                        total: { $sum: 1 },
                        present: { $sum: { $cond: [{ $in: ['$status', ['present','late']] }, 1, 0] } },
                    }},
            ]),

            // Submission has no direct subject reference (only `assignment`),
            // so we join through Assignment — which does carry `subject` —
            // to get per-subject submission/grading counts.
            Submission.aggregate([
                { $lookup: {
                        from: 'assignments',
                        localField: 'assignment',
                        foreignField: '_id',
                        as: 'assignmentInfo',
                    }},
                { $unwind: '$assignmentInfo' },
                { $match: { 'assignmentInfo.subject': { $in: subjectIds } } },
                { $group: {
                        _id: '$assignmentInfo.subject',
                        total: { $sum: 1 },
                        graded: { $sum: { $cond: [{ $eq: ['$status', 'graded'] }, 1, 0] } },
                    }},
            ]),
        ]);

        const enrollMap = Object.fromEntries(enrollmentCounts.map((e) => [String(e._id), e.count]));
        const attMap = Object.fromEntries(attendanceRates.map((a) => [String(a._id), Math.round((a.present / a.total) * 100)]));
        const subMap = Object.fromEntries(submissionRates.map((s) => [String(s._id), { total: s.total, graded: s.graded }]));

        const analytics = subjects.map((s) => ({
            _id: s._id,
            name: s.name,
            code: s.code,
            credits: s.credits,
            bucket: s.bucket,
            isMandatory: s.isMandatory,
            enrolled: enrollMap[String(s._id)] || 0,
            attendanceRate: attMap[String(s._id)] || 0,
            submissions: subMap[String(s._id)]?.total || 0,
            graded: subMap[String(s._id)]?.graded || 0,
        }));

        res.status(200).json({ success: true, analytics });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── STUDENT: personal report ────────────────────────────────────────────────
exports.getStudentReport = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.user._id;

        if (req.user.role === 'student' && String(req.user._id) !== String(studentId)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const [enrollments, attendanceSummary, submissions, quizAttempts] = await Promise.all([
            SubjectEnrollment.find({ student: studentId })
                .populate('subject', 'name code credits bucket isMandatory'),

            Attendance.aggregate([
                { $match: { student: mongoose.Types.ObjectId.createFromHexString(String(studentId)) } },
                { $group: {
                        _id: '$subject',
                        total: { $sum: 1 },
                        present: { $sum: { $cond: [{ $in: ['$status', ['present','late']] }, 1, 0] } },
                    }},
            ]),

            Submission.find({ student: studentId })
                .populate('assignment', 'title totalMarks'),

            Quiz.find({ 'attempts.student': studentId })
                .select('title totalMarks attempts'),
        ]);

        const totalClasses = attendanceSummary.reduce((s, a) => s + a.total, 0);
        const presentClasses = attendanceSummary.reduce((s, a) => s + a.present, 0);
        const overallAttendance = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

        const gradedSubs = submissions.filter((s) => s.status === 'graded' && s.marks !== null);
        const avgMarks = gradedSubs.length > 0
            ? Math.round(gradedSubs.reduce((s, sub) => s + (sub.marks / sub.assignment?.totalMarks) * 100, 0) / gradedSubs.length)
            : 0;

        const myAttempts = quizAttempts.flatMap((q) =>
            q.attempts.filter((a) => String(a.student) === String(studentId))
                .map((a) => ({ quizTitle: q.title, score: a.score, total: q.totalMarks, percentage: a.percentage, passed: a.passed }))
        );
        const avgQuizScore = myAttempts.length > 0
            ? Math.round(myAttempts.reduce((s, a) => s + a.percentage, 0) / myAttempts.length)
            : 0;

        res.status(200).json({
            success: true,
            report: {
                enrollments,
                overallAttendance,
                totalClasses,
                presentClasses,
                attendanceSummary,
                submissions: gradedSubs,
                avgMarks,
                quizAttempts: myAttempts,
                avgQuizScore,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── TEACHER: class performance report ───────────────────────────────────────
// Already subject-based under the hood (Attendance groups by `$subject`,
// Assignment/Submission relate via `assignment`) — no course/enrollment
// concept was ever in this function, so nothing to migrate here.
exports.getTeacherReport = async (req, res) => {
    try {
        const teacherId = req.user._id;

        const assignments = await Assignment.find({ teacher: teacherId });
        const assignmentIds = assignments.map((a) => a._id);

        const [submissions, attendanceBySubjectRaw, quizResults] = await Promise.all([
            Submission.find({ assignment: { $in: assignmentIds } })
                .populate('student', 'name email profilePhoto')
                .populate({ path: 'assignment', select: 'title totalMarks subject', populate: { path: 'subject', select: 'name code' } })
                .sort({ submittedAt: -1 }),

            Attendance.aggregate([
                { $match: { markedBy: mongoose.Types.ObjectId.createFromHexString(String(teacherId)) } },
                { $group: {
                        _id: '$subject',
                        total: { $sum: 1 },
                        present: { $sum: { $cond: [{ $in: ['$status', ['present','late']] }, 1, 0] } },
                    }},
                { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subjectInfo' } },
                { $unwind: '$subjectInfo' },
            ]),

            Quiz.find({ teacher: teacherId }).select('title totalMarks attempts'),
        ]);

        // Attach subject name/code + attendance rate so the frontend doesn't
        // need to look anything up itself.
        const attendanceBySubject = attendanceBySubjectRaw.map((a) => ({
            subjectId:   a._id,
            subjectName: a.subjectInfo.name,
            subjectCode: a.subjectInfo.code,
            total:       a.total,
            present:     a.present,
            rate:        a.total > 0 ? Math.round((a.present / a.total) * 100) : 0,
        }));

        const gradedCount = submissions.filter((s) => s.status === 'graded').length;
        const pendingCount = submissions.filter((s) => s.status === 'submitted').length;

        const avgClassScore = gradedCount > 0
            ? Math.round(
                submissions.filter((s) => s.status === 'graded' && s.marks !== null)
                    .reduce((sum, s) => sum + (s.marks / s.assignment.totalMarks) * 100, 0) / gradedCount
            )
            : 0;

        const quizSummary = quizResults.map((q) => ({
            title: q.title,
            attempts: q.attempts.length,
            avgScore: q.attempts.length > 0
                ? Math.round(q.attempts.reduce((s, a) => s + a.percentage, 0) / q.attempts.length)
                : 0,
            passRate: q.attempts.length > 0
                ? Math.round((q.attempts.filter((a) => a.passed).length / q.attempts.length) * 100)
                : 0,
        }));

        res.status(200).json({
            success: true,
            report: {
                totalAssignments: assignments.length,
                totalSubmissions: submissions.length,
                gradedCount,
                pendingCount,
                avgClassScore,
                attendanceBySubject,
                quizSummary,
                recentSubmissions: submissions.slice(0, 20),   // already sorted by submittedAt desc
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PDF: student report card ─────────────────────────────────────────────────
exports.exportStudentPDF = async (req, res) => {
    try {
        const studentId = req.params.studentId;
        const student = await User.findById(studentId).select('name email role');
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const [enrollments, attendanceSummary, submissions] = await Promise.all([
            SubjectEnrollment.find({ student: studentId }).populate('subject', 'name code'),
            Attendance.aggregate([
                { $match: { student: mongoose.Types.ObjectId.createFromHexString(String(studentId)) } },
                { $group: {
                        _id: '$subject',
                        total: { $sum: 1 },
                        present: { $sum: { $cond: [{ $in: ['$status',['present','late']] }, 1, 0] } },
                    }},
            ]),
            Submission.find({ student: studentId, status: 'graded' })
                .populate('assignment', 'title totalMarks'),
        ]);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report-${student.name.replace(/\s/g,'-')}.pdf`);
        doc.pipe(res);

        addHeader(doc, 'Student Report Card', `Generated ${new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}`);

        // Student info
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text(student.name, 40, doc.y);
        doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text(student.email);
        doc.moveDown(1);

        // Summary stats
        const totalClasses = attendanceSummary.reduce((s, a) => s + a.total, 0);
        const presentClasses = attendanceSummary.reduce((s, a) => s + a.present, 0);
        const overallAtt = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;
        const avgMarks = submissions.length > 0
            ? Math.round(submissions.reduce((s, sub) => s + (sub.marks / sub.assignment?.totalMarks) * 100, 0) / submissions.length)
            : 0;

        addStatRow(doc, [
            { label: 'Subjects enrolled', value: enrollments.length, color: '#4F46E5' },
            { label: 'Overall attendance', value: `${overallAtt}%`, color: overallAtt >= 75 ? '#059669' : '#DC2626' },
            { label: 'Avg assignment score', value: `${avgMarks}%`, color: '#7C3AED' },
            { label: 'Assignments graded', value: submissions.length, color: '#D97706' },
        ]);

        doc.moveDown(1);

        // Enrollment table
        if (enrollments.length > 0) {
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Enrolled subjects');
            doc.moveDown(0.5);
            addTable(
                doc,
                ['Subject code', 'Subject name', 'Status'],
                enrollments.map((e) => [e.subject?.code, e.subject?.name, e.status]),
                [100, 300, 100]
            );
        }

        doc.moveDown(1);

        // Assignment grades
        if (submissions.length > 0) {
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Assignment grades');
            doc.moveDown(0.5);
            addTable(
                doc,
                ['Assignment', 'Marks', 'Out of', 'Percentage'],
                submissions.map((s) => [
                    s.assignment?.title,
                    s.marks,
                    s.assignment?.totalMarks,
                    `${Math.round((s.marks / s.assignment?.totalMarks) * 100)}%`,
                ]),
                [250, 80, 80, 90]
            );
        }

        doc.end();
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PDF: fee collection report ────────────────────────────────────────────────
exports.exportFeesPDF = async (req, res) => {
    try {
        const { sectionId, gradeId, status } = req.query;
        const filter = {};
        if (sectionId) filter.section = sectionId;
        if (gradeId)   filter.grade   = gradeId;
        if (status)    filter.status  = status;

        const fees = await Fee.find(filter)
            .populate('student', 'name email')
            .populate({ path: 'section', select: 'name grade', populate: { path: 'grade', select: 'name' } })
            .sort({ dueDate: 1 });

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=fee-report.pdf');
        doc.pipe(res);

        addHeader(doc, 'Fee Collection Report', `Generated ${new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}`);

        const totalExpected = fees.reduce((s, f) => s + f.netAmount, 0);
        const totalCollected = fees.reduce((s, f) => s + f.paidAmount, 0);

        addStatRow(doc, [
            { label: 'Total invoices', value: fees.length, color: '#4F46E5' },
            { label: 'Expected (LKR)', value: totalExpected.toLocaleString(), color: '#7C3AED' },
            { label: 'Collected (LKR)', value: totalCollected.toLocaleString(), color: '#059669' },
            { label: 'Outstanding (LKR)', value: (totalExpected - totalCollected).toLocaleString(), color: '#DC2626' },
        ]);

        doc.moveDown(1);

        addTable(
            doc,
            ['Student', 'Section', 'Title', 'Amount', 'Paid', 'Due date', 'Status'],
            fees.map((f) => [
                f.student?.name,
                `${f.section?.grade?.name || ''} ${f.section?.name || ''}`.trim(),
                f.title,
                `LKR ${f.netAmount.toLocaleString()}`,
                `LKR ${f.paidAmount.toLocaleString()}`,
                new Date(f.dueDate).toLocaleDateString('en-GB'),
                f.status,
            ]),
            [130, 90, 130, 90, 90, 90, 70]
        );

        doc.end();
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PDF: attendance report ────────────────────────────────────────────────────
exports.exportAttendancePDF = async (req, res) => {
    try {
        const { subjectId } = req.query;
        const filter = subjectId ? { subject: mongoose.Types.ObjectId.createFromHexString(subjectId) } : {};

        const report = await Attendance.aggregate([
            { $match: filter },
            { $group: {
                    _id: '$student',
                    total: { $sum: 1 },
                    present: { $sum: { $cond: [{ $in: ['$status',['present','late']] }, 1, 0] } },
                    absent: { $sum: { $cond: [{ $eq: ['$status','absent'] }, 1, 0] } },
                }},
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
            { $unwind: '$student' },
            { $sort: { 'student.name': 1 } },
        ]);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.pdf');
        doc.pipe(res);

        addHeader(doc, 'Attendance Report', `Generated ${new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}`);

        addTable(
            doc,
            ['Student', 'Email', 'Total', 'Present', 'Absent', 'Rate'],
            report.map((r) => [
                r.student.name,
                r.student.email,
                r.total,
                r.present,
                r.absent,
                `${Math.round((r.present / r.total) * 100)}%`,
            ]),
            [150, 180, 50, 60, 60, 55]
        );

        doc.end();
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};