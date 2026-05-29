import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchTeacherReport } from '../../store/slices/reportSlice';
import './TeacherDashboard.css';

export default function TeacherDashboard() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((s) => s.auth);
    const { teacherReport: report, loading } = useSelector((s) => s.reports);

    useEffect(() => {
        dispatch(fetchTeacherReport());
    }, [dispatch]);

    const gradingRate = report?.totalSubmissions > 0
        ? Math.round((report.gradedCount / report.totalSubmissions) * 100)
        : 0;

    const stats = [
        {
            label: 'Assignments',
            value: loading ? '…' : report?.totalAssignments ?? '—',
            sub: 'Created',
            icon: '📝',
            iconColor: '#4F46E5',
            iconBg: '#EEF2FF',
            onClick: () => navigate('/teacher/assignments'),
        },
        {
            label: 'Submissions',
            value: loading ? '…' : report?.totalSubmissions ?? '—',
            sub: `${report?.pendingCount ?? 0} pending review`,
            icon: '📥',
            iconColor: '#7C3AED',
            iconBg: '#F5F3FF',
            onClick: () => navigate('/teacher/assignments'),
        },
        {
            label: 'Graded',
            value: loading ? '…' : report?.gradedCount ?? '—',
            sub: `${gradingRate}% grading rate`,
            icon: '✅',
            iconColor: '#059669',
            iconBg: '#ECFDF5',
            onClick: () => navigate('/teacher/grades'),
        },
        {
            label: 'Avg class score',
            value: loading ? '…' : report?.avgClassScore > 0 ? `${report.avgClassScore}%` : '—',
            sub: 'Across all assignments',
            icon: '📊',
            iconColor: '#D97706',
            iconBg: '#FFFBEB',
            onClick: () => navigate('/teacher/grades'),
        },
    ];

    const recentSubmissions = report?.recentSubmissions?.slice(0, 5) || [];

    const greetingHour = new Date().getHours();
    const greeting =
        greetingHour < 12 ? 'Good morning' :
            greetingHour < 17 ? 'Good afternoon' :
                'Good evening';

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                {/* Topbar */}
                <div className="topbar">
                    <h1 className="topbar__title">Dashboard</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <span className="badge badge-teacher">Teacher</span>
                    </div>
                </div>

                <div className="page-body">
                    {/* Welcome */}
                    <div className="dashboard-welcome">
                        <div className="dashboard-welcome__text">
                            <h2>{greeting}, {user?.name?.split(' ')[0]} 👋</h2>
                            <p>Here's your teaching overview.</p>
                        </div>
                        {report?.pendingCount > 0 && (
                            <div
                                className="alert alert-info"
                                style={{ margin: 0, cursor: 'pointer' }}
                                onClick={() => navigate('/teacher/assignments')}
                            >
                                📋 {report.pendingCount} submission{report.pendingCount !== 1 ? 's' : ''} waiting for review
                            </div>
                        )}
                    </div>

                    {/* Stat cards */}
                    <div className="stats-grid">
                        {stats.map((s) => (
                            <div
                                key={s.label}
                                className="stat-card"
                                style={{ cursor: 'pointer' }}
                                onClick={s.onClick}
                            >
                                <div
                                    className="stat-card__icon"
                                    style={{ background: s.iconBg, color: s.iconColor }}
                                >
                                    {s.icon}
                                </div>
                                <div className="stat-card__value">{s.value}</div>
                                <div className="stat-card__label">{s.label}</div>
                                <div className="stat-card__sub">{s.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="content-grid">
                        {/* Recent submissions */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Recent submissions</span>
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => navigate('/teacher/assignments')}
                                >
                                    View all
                                </button>
                            </div>

                            {recentSubmissions.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state__icon">📥</div>
                                    <p>No submissions yet.</p>
                                </div>
                            ) : (
                                <div className="teacher-submission-list">
                                    {recentSubmissions.map((s) => (
                                        <div key={s._id} className="teacher-submission-item">
                                            <div className="teacher-submission-item__avatar">
                                                {s.student?.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="teacher-submission-item__info">
                                                <div className="teacher-submission-item__student">
                                                    {s.student?.name}
                                                </div>
                                                <div className="teacher-submission-item__assignment">
                                                    {s.assignment?.title}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span
                            className={`badge ${
                                s.status === 'graded' ? 'badge-success' : 'badge-student'
                            }`}
                        >
                          {s.status}
                        </span>
                                                {s.marks !== null && (
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                        {s.marks}/{s.assignment?.totalMarks}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick links */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Quick access</span>
                            </div>
                            <div className="quick-links">
                                {[
                                    { label: 'Manage lessons', icon: '📖', path: '/teacher/lessons', color: '#4F46E5', bg: '#EEF2FF' },
                                    { label: 'Assignments', icon: '📝', path: '/teacher/assignments', color: '#7C3AED', bg: '#F5F3FF' },
                                    { label: 'Mark attendance', icon: '✅', path: '/teacher/attendance', color: '#059669', bg: '#ECFDF5' },
                                    { label: 'Performance report', icon: '📊', path: '/teacher/grades', color: '#D97706', bg: '#FFFBEB' },
                                    { label: 'Announcements', icon: '📢', path: '/announcements', color: '#DC2626', bg: '#FEF2F2' },
                                ].map((link) => (
                                    <button
                                        key={link.path}
                                        className="quick-link-btn"
                                        onClick={() => navigate(link.path)}
                                    >
                    <span
                        className="quick-link-btn__icon"
                        style={{ background: link.bg, color: link.color }}
                    >
                      {link.icon}
                    </span>
                                        <span className="quick-link-btn__label">{link.label}</span>
                                        <span className="quick-link-btn__arrow">→</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}