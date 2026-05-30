import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Sidebar from '../../components/Sidebar';
import { fetchAdminDashboard, fetchCourseAnalytics } from '../../store/slices/reportSlice';
import api from '../../api/axios';
import './AdminReports.css';

const PALETTE = ['#4F46E5', '#7C3AED', '#059669', '#D97706', '#DC2626', '#2563EB'];

export default function AdminReports() {
    const dispatch = useDispatch();
    const { adminStats: stats, enrollmentTrend, courseAnalytics, loading } = useSelector((s) => s.reports);
    const [activeTab, setActiveTab] = useState('overview');
    const [exporting, setExporting] = useState('');

    useEffect(() => {
        dispatch(fetchAdminDashboard());
        dispatch(fetchCourseAnalytics());
    }, [dispatch]);

    const handleExport = async (type) => {
        setExporting(type);
        try {
            const url = `/reports/export/${type}`;
            const response = await api.get(url, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${type}-report.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            alert('Export failed. Please try again.');
        }
        setExporting('');
    };

    const fmtCurrency = (n) => `LKR ${Number(n || 0).toLocaleString()}`;

    const submissionData = stats ? [
        { name: 'Graded', value: stats.gradedAssignments },
        { name: 'Pending', value: stats.submittedAssignments },
    ] : [];

    const feeData = stats ? [
        { name: 'Collected', value: stats.totalCollected },
        { name: 'Outstanding', value: stats.totalExpected - stats.totalCollected },
    ] : [];

    const TABS = ['overview', 'courses', 'exports'];

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Reports & analytics</h1>
                    <div className="topbar__right">
                        {TABS.map((t) => (
                            <button
                                key={t}
                                className={`report-tab-btn ${activeTab === t ? 'active' : ''}`}
                                onClick={() => setActiveTab(t)}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="page-body">
                    {loading && !stats ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
                        </div>
                    ) : (
                        <>
                            {/* ── OVERVIEW TAB ── */}
                            {activeTab === 'overview' && stats && (
                                <>
                                    {/* KPI cards */}
                                    <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                                        {[
                                            { label: 'Students', value: stats.totalStudents, icon: '👨‍🎓', color: '#4F46E5', bg: '#EEF2FF' },
                                            { label: 'Teachers', value: stats.totalTeachers, icon: '👩‍🏫', color: '#7C3AED', bg: '#F5F3FF' },
                                            { label: 'Active courses', value: stats.totalCourses, icon: '📚', color: '#0F766E', bg: '#F0FDFA' },
                                            { label: 'Enrollments', value: stats.activeEnrollments, icon: '🎓', color: '#2563EB', bg: '#EFF6FF' },
                                            { label: 'Attendance rate', value: `${stats.attendanceRate}%`, icon: '✅', color: stats.attendanceRate >= 75 ? '#059669' : '#DC2626', bg: stats.attendanceRate >= 75 ? '#ECFDF5' : '#FEF2F2' },
                                            { label: 'Fee collection', value: `${stats.feeCollectionRate}%`, icon: '💳', color: '#D97706', bg: '#FFFBEB' },
                                        ].map((s) => (
                                            <div key={s.label} className="stat-card">
                                                <div className="stat-card__icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                                                <div className="stat-card__value">{s.value}</div>
                                                <div className="stat-card__label">{s.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Charts row */}
                                    <div className="reports-charts-grid">
                                        {/* Enrollment trend line chart */}
                                        <div className="card">
                                            <div className="card-header">
                                                <span className="card-title">Enrollment trend (6 months)</span>
                                            </div>
                                            {enrollmentTrend.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <LineChart data={enrollmentTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                                        <YAxis tick={{ fontSize: 11 }} />
                                                        <Tooltip />
                                                        <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4, fill: '#4F46E5' }} name="Enrollments" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="empty-state" style={{ height: 200 }}>
                                                    <p>No enrollment data yet.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Assignment submissions pie */}
                                        <div className="card">
                                            <div className="card-header">
                                                <span className="card-title">Assignment submissions</span>
                                            </div>
                                            {submissionData.some((d) => d.value > 0) ? (
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <PieChart>
                                                        <Pie data={submissionData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                                            {submissionData.map((_, i) => <Cell key={i} fill={PALETTE[i]} />)}
                                                        </Pie>
                                                        <Tooltip />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="empty-state" style={{ height: 200 }}><p>No submissions yet.</p></div>
                                            )}
                                        </div>

                                        {/* Fee collection bar */}
                                        <div className="card">
                                            <div className="card-header">
                                                <span className="card-title">Fee collection</span>
                                            </div>
                                            <div style={{ padding: 'var(--space-md) 0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)', fontSize: '0.875rem' }}>
                                                    <span style={{ color: 'var(--color-text-secondary)' }}>Expected</span>
                                                    <span style={{ fontWeight: 600 }}>{fmtCurrency(stats.totalExpected)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)', fontSize: '0.875rem' }}>
                                                    <span style={{ color: 'var(--color-text-secondary)' }}>Collected</span>
                                                    <span style={{ fontWeight: 600, color: '#059669' }}>{fmtCurrency(stats.totalCollected)}</span>
                                                </div>
                                                <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-md)' }}>
                                                    <div style={{ height: '100%', width: `${stats.feeCollectionRate}%`, background: stats.feeCollectionRate >= 70 ? '#059669' : '#D97706', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                    <span>Outstanding: {fmtCurrency(stats.totalExpected - stats.totalCollected)}</span>
                                                    <span>{stats.feeCollectionRate}% collected</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ── COURSES TAB ── */}
                            {activeTab === 'courses' && (
                                <>
                                    {courseAnalytics.length > 0 ? (
                                        <>
                                            {/* Enrollment bar chart */}
                                            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                                                <div className="card-header">
                                                    <span className="card-title">Students per course</span>
                                                </div>
                                                <ResponsiveContainer width="100%" height={280}>
                                                    <BarChart data={courseAnalytics.slice(0, 10)} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                                        <XAxis dataKey="code" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                                                        <YAxis tick={{ fontSize: 11 }} />
                                                        <Tooltip formatter={(v, n) => [v, n]} />
                                                        <Bar dataKey="enrolled" fill="#4F46E5" name="Enrolled" radius={[4, 4, 0, 0]} />
                                                        <Bar dataKey="maxStudents" fill="#E5E7EB" name="Capacity" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Attendance rate chart */}
                                            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                                                <div className="card-header">
                                                    <span className="card-title">Attendance rate by course (last 30 days)</span>
                                                </div>
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <BarChart data={courseAnalytics.slice(0, 10)} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                                        <XAxis dataKey="code" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                                                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                                                        <Tooltip formatter={(v) => [`${v}%`, 'Attendance rate']} />
                                                        <Bar dataKey="attendanceRate" name="Attendance %" radius={[4, 4, 0, 0]}>
                                                            {courseAnalytics.slice(0, 10).map((c, i) => (
                                                                <Cell key={i} fill={c.attendanceRate >= 75 ? '#059669' : c.attendanceRate >= 60 ? '#D97706' : '#DC2626'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Course analytics table */}
                                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                                <table className="data-table">
                                                    <thead>
                                                    <tr>
                                                        <th>Course</th>
                                                        <th>Department</th>
                                                        <th>Enrolled</th>
                                                        <th>Capacity</th>
                                                        <th>Attendance</th>
                                                        <th>Submissions</th>
                                                        <th>Graded</th>
                                                    </tr>
                                                    </thead>
                                                    <tbody>
                                                    {courseAnalytics.map((c) => (
                                                        <tr key={c._id}>
                                                            <td>
                                                                <div style={{ fontWeight: 500 }}>{c.title}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                                                    {c.code}
                                                                </div>
                                                            </td>
                                                            <td style={{ color: 'var(--color-text-secondary)' }}>{c.department}</td>
                                                            <td style={{ fontWeight: 600 }}>{c.enrolled}</td>
                                                            <td style={{ color: 'var(--color-text-muted)' }}>{c.maxStudents}</td>
                                                            <td>
          <span style={{
              fontWeight: 600,
              color: c.attendanceRate >= 75 ? '#059669'
                  : c.attendanceRate >= 60 ? '#D97706'
                      : '#DC2626',
          }}>
            {c.attendanceRate}%
          </span>
                                                            </td>
                                                            <td style={{ color: 'var(--color-text-secondary)' }}>{c.submissions}</td>
                                                            <td style={{ color: 'var(--color-text-secondary)' }}>{c.graded}</td>
                                                        </tr>
                                                    ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="empty-state">
                                            <div className="empty-state__icon">📊</div>
                                            <p>No course data available yet.</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── EXPORTS TAB ── */}
                            {activeTab === 'exports' && (
                                <div className="exports-grid">
                                    {[
                                        {
                                            key: 'fees',
                                            title: 'Fee collection report',
                                            desc: 'Complete list of all fee invoices, payment status, and outstanding balances in PDF format.',
                                            icon: '💳',
                                            color: '#D97706',
                                            bg: '#FFFBEB',
                                        },
                                        {
                                            key: 'attendance',
                                            title: 'Attendance report',
                                            desc: 'Attendance summary for all students across all courses with individual rates.',
                                            icon: '✅',
                                            color: '#059669',
                                            bg: '#ECFDF5',
                                        },
                                    ].map((e) => (
                                        <div key={e.key} className="export-card card">
                                            <div className="export-card__icon" style={{ background: e.bg, color: e.color }}>
                                                {e.icon}
                                            </div>
                                            <h3 className="export-card__title">{e.title}</h3>
                                            <p className="export-card__desc">{e.desc}</p>
                                            <button
                                                className="btn btn-outline"
                                                style={{ marginTop: 'auto' }}
                                                onClick={() => handleExport(e.key)}
                                                disabled={exporting === e.key}
                                            >
                                                {exporting === e.key
                                                    ? <><span className="spinner" style={{ borderColor: 'rgba(79,70,229,0.3)', borderTopColor: '#4F46E5' }}></span> Generating…</>
                                                    : '⬇ Download PDF'}
                                            </button>
                                        </div>
                                    ))}

                                    {/* Per-student report card export */}
                                    <div className="export-card card export-card--wide">
                                        <div className="export-card__icon" style={{ background: '#EEF2FF', color: '#4F46E5' }}>👨‍🎓</div>
                                        <h3 className="export-card__title">Student report card</h3>
                                        <p className="export-card__desc">Export a full report card PDF for any student — enrollment, attendance, and grades.</p>
                                        <StudentExportForm />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function StudentExportForm() {
    const [studentId, setStudentId] = useState('');
    const [exporting, setExporting] = useState(false);

    const handleExport = async (e) => {
        e.preventDefault();
        if (!studentId.trim()) return;
        setExporting(true);
        try {
            const response = await api.get(`/reports/export/student/${studentId}`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'student-report.pdf';
            link.click();
            URL.revokeObjectURL(link.href);
        } catch {
            alert('Export failed. Check the student ID and try again.');
        }
        setExporting(false);
    };

    return (
        <form onSubmit={handleExport} style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'auto', flexWrap: 'wrap' }}>
            <input
                className="form-input"
                style={{ flex: 1, minWidth: 200 }}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Paste student MongoDB ID"
                required
            />
            <button type="submit" className="btn btn-outline" disabled={exporting}>
                {exporting ? <><span className="spinner" style={{ borderColor: 'rgba(79,70,229,0.3)', borderTopColor: '#4F46E5' }}></span> Generating…</> : '⬇ Export'}
            </button>
        </form>
    );
}