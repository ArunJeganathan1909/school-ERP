import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';
import Sidebar from '../../components/Sidebar';
import { fetchTeacherReport } from '../../store/slices/reportSlice';
import './TeacherReport.css';

export default function TeacherReport() {
    const dispatch = useDispatch();
    const { teacherReport: report, loading } = useSelector((s) => s.reports);

    useEffect(() => {
        dispatch(fetchTeacherReport());
    }, [dispatch]);

    if (loading || !report) return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
            </div>
        </div>
    );

    const gradingRate = report.totalSubmissions > 0
        ? Math.round((report.gradedCount / report.totalSubmissions) * 100)
        : 0;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Class performance</h1>
                    <span className="badge badge-teacher">Teacher</span>
                </div>

                <div className="page-body">
                    {/* Summary cards */}
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                        {[
                            { label: 'Assignments',       value: report.totalAssignments,  icon: '📝', color: '#4F46E5', bg: '#EEF2FF' },
                            { label: 'Submissions',        value: report.totalSubmissions,  icon: '📥', color: '#7C3AED', bg: '#F5F3FF' },
                            { label: 'Graded',             value: report.gradedCount,       icon: '✅', color: '#059669', bg: '#ECFDF5' },
                            { label: 'Pending review',     value: report.pendingCount,      icon: '⏳', color: '#D97706', bg: '#FFFBEB' },
                            { label: 'Avg class score',    value: report.avgClassScore > 0 ? `${report.avgClassScore}%` : '—', icon: '📊', color: '#2563EB', bg: '#EFF6FF' },
                            { label: 'Grading rate',       value: `${gradingRate}%`,        icon: '🎯', color: gradingRate >= 80 ? '#059669' : '#D97706', bg: gradingRate >= 80 ? '#ECFDF5' : '#FFFBEB' },
                        ].map((s) => (
                            <div key={s.label} className="stat-card">
                                <div className="stat-card__icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                                <div className="stat-card__value">{s.value}</div>
                                <div className="stat-card__label">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="teacher-report-grid">
                        {/* Quiz performance */}
                        {report.quizSummary.length > 0 && (
                            <div className="card">
                                <div className="card-header">
                                    <span className="card-title">Quiz pass rates</span>
                                </div>
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={report.quizSummary} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                        <XAxis dataKey="title" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                                        <Tooltip formatter={(v, n) => [`${v}%`, n]} />
                                        <Bar dataKey="passRate" fill="#4F46E5" name="Pass rate %" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="avgScore" fill="#7C3AED" name="Avg score %" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Grading progress */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Grading progress</span>
                            </div>
                            <div style={{ padding: 'var(--space-lg) 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)', fontSize: '0.875rem' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Graded</span>
                                    <span style={{ fontWeight: 600, color: '#059669' }}>{report.gradedCount}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)', fontSize: '0.875rem' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Pending</span>
                                    <span style={{ fontWeight: 600, color: '#D97706' }}>{report.pendingCount}</span>
                                </div>
                                <div style={{ height: 10, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-md)' }}>
                                    <div style={{ height: '100%', width: `${gradingRate}%`, background: gradingRate >= 80 ? '#059669' : '#D97706', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                                </div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                    {gradingRate}% of all submissions graded
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Recent submissions table */}
                    {report.recentSubmissions.length > 0 && (
                        <>
                            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 'var(--space-xl) 0 var(--space-md)' }}>Recent submissions</h2>
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                    <tr><th>Student</th><th>Assignment</th><th>Submitted</th><th>Marks</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                    {report.recentSubmissions.map((s) => (
                                        <tr key={s._id}>
                                            <td style={{ fontWeight: 500 }}>{s.student?.name}</td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{s.assignment?.title}</td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>
                                                {new Date(s.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                {s.isLate && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#D97706', fontWeight: 600 }}>LATE</span>}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                {s.marks !== null ? `${s.marks} / ${s.assignment?.totalMarks}` : '—'}
                                            </td>
                                            <td>
                          <span className={`badge ${s.status === 'graded' ? 'badge-success' : 'badge-student'}`}>
                            {s.status}
                          </span>
                                            </td>
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