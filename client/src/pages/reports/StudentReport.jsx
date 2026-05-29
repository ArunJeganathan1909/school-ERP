import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    RadialBarChart, RadialBar, PolarAngleAxis,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import Sidebar from '../../components/Sidebar';
import { fetchStudentReport } from '../../store/slices/reportSlice';
import './StudentReport.css';

export default function StudentReport() {
    const dispatch = useDispatch();
    const { user } = useSelector((s) => s.auth);
    const { studentReport: report, loading } = useSelector((s) => s.reports);

    useEffect(() => {
        if (user?._id) dispatch(fetchStudentReport(user._id));
    }, [dispatch, user?._id]);

    if (loading || !report) return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
            </div>
        </div>
    );

    const attColor = report.overallAttendance >= 75 ? '#059669' : report.overallAttendance >= 60 ? '#D97706' : '#DC2626';

    const assignmentData = report.submissions.map((s) => ({
        name: s.assignment?.title?.slice(0, 20) || 'Assignment',
        score: Math.round((s.marks / s.assignment?.totalMarks) * 100),
    }));

    const quizData = report.quizAttempts.map((a) => ({
        name: a.quizTitle?.slice(0, 20) || 'Quiz',
        score: Math.round(a.percentage),
    }));

    const radialData = [{ name: 'Attendance', value: report.overallAttendance, fill: attColor }];

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">My report</h1>
                    <span className="badge badge-student">Student</span>
                </div>

                <div className="page-body">
                    {/* Summary cards */}
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                        {[
                            { label: 'Courses enrolled', value: report.enrollments.length, icon: '📚', color: '#4F46E5', bg: '#EEF2FF' },
                            { label: 'Classes attended', value: `${report.presentClasses} / ${report.totalClasses}`, icon: '✅', color: '#059669', bg: '#ECFDF5' },
                            { label: 'Avg assignment score', value: report.avgMarks > 0 ? `${report.avgMarks}%` : '—', icon: '📝', color: '#7C3AED', bg: '#F5F3FF' },
                            { label: 'Avg quiz score', value: report.avgQuizScore > 0 ? `${report.avgQuizScore}%` : '—', icon: '🎯', color: '#D97706', bg: '#FFFBEB' },
                        ].map((s) => (
                            <div key={s.label} className="stat-card">
                                <div className="stat-card__icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                                <div className="stat-card__value">{s.value}</div>
                                <div className="stat-card__label">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="student-report-grid">
                        {/* Attendance radial */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Overall attendance</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <ResponsiveContainer width="100%" height={200}>
                                    <RadialBarChart
                                        cx="50%" cy="50%"
                                        innerRadius="60%" outerRadius="90%"
                                        data={radialData}
                                        startAngle={90} endAngle={-270}
                                    >
                                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                                        <RadialBar background dataKey="value" angleAxisId={0} cornerRadius={8} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <div style={{ textAlign: 'center', marginTop: -16 }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: attColor, lineHeight: 1 }}>
                                        {report.overallAttendance}%
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        {report.totalClasses} total classes
                                    </div>
                                </div>
                                {report.overallAttendance < 75 && (
                                    <div className="alert alert-error" style={{ marginTop: 'var(--space-md)', width: '100%' }}>
                                        ⚠ Below 75% minimum requirement
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assignment scores bar chart */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Assignment scores</span>
                            </div>
                            {assignmentData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={assignmentData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                                        <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                                        <Bar dataKey="score" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Score %" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state" style={{ height: 180 }}>
                                    <p>No graded assignments yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Quiz scores */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Quiz performance</span>
                            </div>
                            {quizData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={quizData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                                        <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                                        <Bar dataKey="score" radius={[4, 4, 0, 0]} name="Score %">
                                            {quizData.map((q, i) => (
                                                <Cell key={i} fill={q.score >= 50 ? '#059669' : '#DC2626'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state" style={{ height: 180 }}>
                                    <p>No quiz attempts yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Enrollment table */}
                    {report.enrollments.length > 0 && (
                        <>
                            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 'var(--space-xl) 0 var(--space-md)' }}>Enrolled courses</h2>
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                    <tr><th>Course</th><th>Code</th><th>Department</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                    {report.enrollments.map((e) => (
                                        <tr key={e._id}>
                                            <td style={{ fontWeight: 500 }}>{e.course?.title}</td>
                                            <td><span style={{ background: '#EEF2FF', color: '#4F46E5', fontWeight: 700, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>{e.course?.code}</span></td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{e.course?.department}</td>
                                            <td><span className={`badge badge-${e.status === 'active' ? 'success' : 'error'}`}>{e.status}</span></td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}