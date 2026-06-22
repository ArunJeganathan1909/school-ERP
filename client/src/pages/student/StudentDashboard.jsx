import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchStudentReport } from '../../store/slices/reportSlice';
import { fetchMyAttendance } from '../../store/slices/attendanceSlice';
import { fetchMySubjects } from '../../store/slices/subjectEnrollmentSlice';
import { fetchActiveYear } from '../../store/slices/academicYearSlice';
import './StudentDashboard.css';

export default function StudentDashboard() {
    const dispatch  = useDispatch();
    const navigate  = useNavigate();

    const { user }                                   = useSelector((s) => s.auth);
    const { studentReport: report, loading: reportLoading } = useSelector((s) => s.reports);
    const { myRecords }                              = useSelector((s) => s.attendance);
    const { myEnrollments, myMandatory, myBuckets, loading: subjectsLoading }
        = useSelector((s) => s.subjectEnrollments);
    const { active: activeYear }                     = useSelector((s) => s.academicYears);

    useEffect(() => {
        dispatch(fetchActiveYear());
    }, [dispatch]);

    useEffect(() => {
        if (user?._id) {
            dispatch(fetchStudentReport(user._id));
            dispatch(fetchMyAttendance());
        }
    }, [dispatch, user?._id]);

    // Fetch subjects once we have the active year
    useEffect(() => {
        if (activeYear?._id) {
            dispatch(fetchMySubjects({ academicYear: activeYear._id }));
        }
    }, [dispatch, activeYear?._id]);

    const overallAtt = report?.overallAttendance ?? null;
    const attColor   =
        overallAtt === null       ? 'var(--color-text-muted)' :
            overallAtt >= 75          ? '#059669' :
                overallAtt >= 60          ? '#D97706' :
                    '#DC2626';

    const totalSubjects  = myEnrollments?.length ?? 0;
    const bucketsAssigned = myBuckets?.length    ?? 0;

    const stats = [
        {
            label:     'My subjects',
            value:     subjectsLoading ? '…' : totalSubjects,
            sub:       `${myMandatory?.length ?? 0} mandatory · ${bucketsAssigned} elective`,
            icon:      '📚',
            iconColor: '#4F46E5',
            iconBg:    '#EEF2FF',
            onClick:   () => navigate('/student/subjects'),
        },
        {
            label:     'Attendance',
            value:     reportLoading ? '…' : overallAtt !== null ? `${overallAtt}%` : '—',
            sub:       `${report?.presentClasses ?? 0} / ${report?.totalClasses ?? 0} classes`,
            icon:      '✅',
            iconColor: attColor,
            iconBg:    overallAtt !== null && overallAtt < 75 ? '#FEF2F2' : '#ECFDF5',
            onClick:   () => navigate('/student/attendance'),
        },
        {
            label:     'Avg assignment score',
            value:     reportLoading ? '…' : report?.avgMarks > 0 ? `${report.avgMarks}%` : '—',
            sub:       `${report?.submissions?.length ?? 0} graded`,
            icon:      '📝',
            iconColor: '#7C3AED',
            iconBg:    '#F5F3FF',
            onClick:   () => navigate('/assignments'),
        },
        {
            label:     'Avg quiz score',
            value:     reportLoading ? '…' : report?.avgQuizScore > 0 ? `${report.avgQuizScore}%` : '—',
            sub:       `${report?.quizAttempts?.length ?? 0} attempts`,
            icon:      '🎯',
            iconColor: '#D97706',
            iconBg:    '#FFFBEB',
            onClick:   () => navigate('/student/grades'),
        },
    ];

    const greetingHour = new Date().getHours();
    const greeting =
        greetingHour < 12 ? 'Good morning' :
            greetingHour < 17 ? 'Good afternoon' :
                'Good evening';

    // Show first 5 mandatory subjects in the recent list
    const recentSubjects = (myMandatory ?? []).slice(0, 5);

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
                            <p>
                                {activeYear
                                    ? `${activeYear.name} · Semester ${activeYear.currentSemester}`
                                    : 'Here\'s your academic overview for today.'
                                }
                            </p>
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

                        {/* My subjects card */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">My subjects</span>
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => navigate('/student/subjects')}
                                >
                                    View all
                                </button>
                            </div>

                            {subjectsLoading ? (
                                <div className="empty-state">
                                    <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                </div>
                            ) : recentSubjects.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state__icon">📚</div>
                                    <p>No subjects enrolled yet.</p>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        Your subjects will appear here once your administrator assigns you to a class.
                                    </p>
                                </div>
                            ) : (
                                <div className="dashboard-course-list">
                                    {recentSubjects.map((enrollment) => {
                                        const subj = enrollment.subject;
                                        return (
                                            <div
                                                key={enrollment._id}
                                                className="dashboard-course-item"
                                                onClick={() => navigate('/student/subjects')}
                                            >
                                                <div className="dashboard-course-item__code">
                                                    {subj?.code}
                                                </div>
                                                <div className="dashboard-course-item__info">
                                                    <div className="dashboard-course-item__title">
                                                        {subj?.name}
                                                    </div>
                                                    <div className="dashboard-course-item__dept">
                                                        {subj?.teacher?.name
                                                            ? `👤 ${subj.teacher.name}`
                                                            : 'No teacher assigned'
                                                        }
                                                    </div>
                                                </div>
                                                <span
                                                    className="badge"
                                                    style={{ background: '#EEF2FF', color: '#4F46E5', flexShrink: 0 }}
                                                >
                          Core
                        </span>
                                            </div>
                                        );
                                    })}

                                    {/* Bucket status row */}
                                    {myBuckets && myBuckets.length > 0 && (
                                        <div
                                            className="dashboard-course-item"
                                            onClick={() => navigate('/student/subjects')}
                                            style={{ borderTop: '2px solid var(--color-border)', marginTop: 'var(--space-xs)' }}
                                        >
                                            <div style={{ fontSize: '1.25rem' }}>🎯</div>
                                            <div className="dashboard-course-item__info">
                                                <div className="dashboard-course-item__title">
                                                    Elective subjects
                                                </div>
                                                <div className="dashboard-course-item__dept">
                                                    {myBuckets.map((e) => e.subject?.name).filter(Boolean).join(', ')}
                                                </div>
                                            </div>
                                            <span
                                                className="badge"
                                                style={{ background: '#F5F3FF', color: '#7C3AED', flexShrink: 0 }}
                                            >
                        {bucketsAssigned} / 4
                      </span>
                                        </div>
                                    )}

                                    {/* Pending buckets warning */}
                                    {bucketsAssigned < 4 && (
                                        <div style={{
                                            padding: 'var(--space-sm) var(--space-md)',
                                            background: '#FFFBEB',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: '0.8125rem',
                                            color: '#D97706',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            marginTop: 'var(--space-xs)',
                                        }}>
                                            ⚠ {4 - bucketsAssigned} elective bucket{4 - bucketsAssigned !== 1 ? 's' : ''} not yet assigned
                                        </div>
                                    )}
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
                                    { label: 'My subjects',       icon: '📚', path: '/student/subjects',    color: '#4F46E5', bg: '#EEF2FF' },
                                    { label: 'My assignments',    icon: '📝', path: '/assignments',          color: '#7C3AED', bg: '#F5F3FF' },
                                    { label: 'Attendance record', icon: '✅', path: '/student/attendance',  color: '#059669', bg: '#ECFDF5' },
                                    { label: 'Fee statements',    icon: '💳', path: '/student/fees',        color: '#D97706', bg: '#FFFBEB' },
                                    { label: 'My grades',         icon: '📊', path: '/student/grades',      color: '#2563EB', bg: '#EFF6FF' },
                                    { label: 'Timetable',         icon: '🗓', path: '/student/timetable',   color: '#0F766E', bg: '#F0FDFA' },
                                    { label: 'Announcements',     icon: '📢', path: '/announcements',       color: '#DC2626', bg: '#FEF2F2' },
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