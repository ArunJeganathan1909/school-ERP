import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchStudentReport } from '../../store/slices/reportSlice';
import { fetchMyEnrollments } from '../../store/slices/enrollmentSlice';
import { fetchMyAttendance } from '../../store/slices/attendanceSlice';
import './StudentDashboard.css';

export default function StudentDashboard() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((s) => s.auth);
    const { studentReport: report, loading: reportLoading } = useSelector((s) => s.reports);
    const { list: enrollments } = useSelector((s) => s.enrollments);
    const { myRecords } = useSelector((s) => s.attendance);

    useEffect(() => {
        if (user?._id) {
            dispatch(fetchStudentReport(user._id));
            dispatch(fetchMyEnrollments());
            dispatch(fetchMyAttendance());
        }
    }, [dispatch, user?._id]);

    const activeEnrollments = enrollments.filter((e) => e.status === 'active').length;
    const overallAtt = report?.overallAttendance ?? null;
    const attColor = overallAtt === null
        ? 'var(--color-text-muted)'
        : overallAtt >= 75 ? '#059669'
            : overallAtt >= 60 ? '#D97706'
                : '#DC2626';

    const pendingAssignments = report?.submissions
        ? 0   // derive from LMS in a later sprint; placeholder
        : null;

    const stats = [
        {
            label: 'Enrolled courses',
            value: reportLoading ? '…' : activeEnrollments,
            sub: 'Active this semester',
            icon: '📚',
            iconColor: '#4F46E5',
            iconBg: '#EEF2FF',
            onClick: () => navigate('/student/courses'),
        },
        {
            label: 'Attendance',
            value: reportLoading ? '…' : overallAtt !== null ? `${overallAtt}%` : '—',
            sub: `${report?.presentClasses ?? 0} / ${report?.totalClasses ?? 0} classes`,
            icon: '✅',
            iconColor: attColor,
            iconBg: overallAtt !== null && overallAtt < 75 ? '#FEF2F2' : '#ECFDF5',
            onClick: () => navigate('/student/attendance'),
        },
        {
            label: 'Avg assignment score',
            value: reportLoading ? '…' : report?.avgMarks > 0 ? `${report.avgMarks}%` : '—',
            sub: `${report?.submissions?.length ?? 0} graded`,
            icon: '📝',
            iconColor: '#7C3AED',
            iconBg: '#F5F3FF',
            onClick: () => navigate('/assignments'),
        },
        {
            label: 'Avg quiz score',
            value: reportLoading ? '…' : report?.avgQuizScore > 0 ? `${report.avgQuizScore}%` : '—',
            sub: `${report?.quizAttempts?.length ?? 0} attempts`,
            icon: '🎯',
            iconColor: '#D97706',
            iconBg: '#FFFBEB',
            onClick: () => navigate('/student/grades'),
        },
    ];

    const recentCourses = enrollments.filter((e) => e.status === 'active').slice(0, 4);

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
                        <span className="badge badge-student">Student</span>
                    </div>
                </div>

                <div className="page-body">
                    {/* Welcome banner */}
                    <div className="dashboard-welcome">
                        <div className="dashboard-welcome__text">
                            <h2>{greeting}, {user?.name?.split(' ')[0]} 👋</h2>
                            <p>Here's your academic overview for today.</p>
                        </div>
                        {overallAtt !== null && overallAtt < 75 && (
                            <div className="alert alert-error" style={{ margin: 0 }}>
                                ⚠ Your attendance is {overallAtt}% — below the 75% minimum.
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

                    {/* Content grid */}
                    <div className="content-grid">
                        {/* Recent courses */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">My courses</span>
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => navigate('/student/courses')}
                                >
                                    View all
                                </button>
                            </div>

                            {recentCourses.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state__icon">📚</div>
                                    <p>No courses enrolled yet.</p>
                                    <button
                                        className="btn btn-primary"
                                        style={{ marginTop: 'var(--space-md)' }}
                                        onClick={() => navigate('/courses')}
                                    >
                                        Browse courses
                                    </button>
                                </div>
                            ) : (
                                <div className="dashboard-course-list">
                                    {recentCourses.map((e) => (
                                        <div
                                            key={e._id}
                                            className="dashboard-course-item"
                                            onClick={() => navigate(`/courses/${e.course?._id}`)}
                                        >
                                            <div className="dashboard-course-item__code">
                                                {e.course?.code}
                                            </div>
                                            <div className="dashboard-course-item__info">
                                                <div className="dashboard-course-item__title">
                                                    {e.course?.title}
                                                </div>
                                                <div className="dashboard-course-item__dept">
                                                    {e.course?.department}
                                                </div>
                                            </div>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: '#ECFDF5',
                                                    color: '#059669',
                                                }}
                                            >
                        Active
                      </span>
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
                                    { label: 'Browse all courses', icon: '🔍', path: '/courses', color: '#4F46E5', bg: '#EEF2FF' },
                                    { label: 'My assignments', icon: '📝', path: '/assignments', color: '#7C3AED', bg: '#F5F3FF' },
                                    { label: 'Attendance record', icon: '✅', path: '/student/attendance', color: '#059669', bg: '#ECFDF5' },
                                    { label: 'Fee statements', icon: '💳', path: '/student/fees', color: '#D97706', bg: '#FFFBEB' },
                                    { label: 'My grades', icon: '📊', path: '/student/grades', color: '#2563EB', bg: '#EFF6FF' },
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