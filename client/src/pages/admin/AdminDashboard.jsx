import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchAdminDashboard } from '../../store/slices/reportSlice';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((s) => s.auth);
    const { adminStats: stats, enrollmentTrend, loading } = useSelector((s) => s.reports);

    useEffect(() => {
        dispatch(fetchAdminDashboard());
    }, [dispatch]);

    const fmtCurrency = (n) => `LKR ${Number(n || 0).toLocaleString()}`;

    const kpiCards = [
        {
            label: 'Total students',
            value: loading ? '…' : stats?.totalStudents ?? '—',
            sub: 'Active registrations',
            icon: '👨‍🎓',
            iconColor: '#4F46E5',
            iconBg: '#EEF2FF',
            onClick: () => navigate('/admin/users'),
        },
        {
            label: 'Teachers',
            value: loading ? '…' : stats?.totalTeachers ?? '—',
            sub: 'Active staff',
            icon: '👩‍🏫',
            iconColor: '#7C3AED',
            iconBg: '#F5F3FF',
            onClick: () => navigate('/admin/users'),
        },
        {
            label: 'Active courses',
            value: loading ? '…' : stats?.totalCourses ?? '—',
            sub: 'This semester',
            icon: '📚',
            iconColor: '#0F766E',
            iconBg: '#F0FDFA',
            onClick: () => navigate('/admin/courses'),
        },
        {
            label: 'Enrollments',
            value: loading ? '…' : stats?.activeEnrollments ?? '—',
            sub: 'Active this semester',
            icon: '🎓',
            iconColor: '#2563EB',
            iconBg: '#EFF6FF',
            onClick: () => navigate('/admin/courses'),
        },
        {
            label: 'Attendance rate',
            value: loading ? '…' : stats ? `${stats.attendanceRate}%` : '—',
            sub: 'Last 30 days',
            icon: '✅',
            iconColor: stats?.attendanceRate >= 75 ? '#059669' : '#DC2626',
            iconBg: stats?.attendanceRate >= 75 ? '#ECFDF5' : '#FEF2F2',
            onClick: () => navigate('/admin/reports'),
        },
        {
            label: 'Fee collection',
            value: loading ? '…' : stats ? `${stats.feeCollectionRate}%` : '—',
            sub: fmtCurrency(stats?.totalCollected),
            icon: '💳',
            iconColor: '#D97706',
            iconBg: '#FFFBEB',
            onClick: () => navigate('/admin/fees'),
        },
    ];

    // Build a simple spark-line from enrollment trend for display
    const maxTrend = Math.max(1, ...enrollmentTrend.map((e) => e.count));

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
                    <h1 className="topbar__title">Admin dashboard</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <span className="badge badge-admin">Admin</span>
                    </div>
                </div>

                <div className="page-body">
                    {/* Welcome */}
                    <div className="dashboard-welcome">
                        <div className="dashboard-welcome__text">
                            <h2>{greeting}, {user?.name?.split(' ')[0]} 👋</h2>
                            <p>System overview — everything at a glance.</p>
                        </div>
                        {stats?.overdueInvoices > 0 && (
                            <div
                                className="alert alert-error"
                                style={{ margin: 0, cursor: 'pointer' }}
                                onClick={() => navigate('/admin/fees')}
                            >
                                ⚠ {stats.overdueInvoices} overdue fee invoice{stats.overdueInvoices !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>

                    {/* KPI grid */}
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                        {kpiCards.map((s) => (
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
                        {/* Enrollment trend mini chart */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Enrollment trend</span>
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => navigate('/admin/reports')}
                                >
                                    Full report →
                                </button>
                            </div>

                            {enrollmentTrend.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state__icon">📈</div>
                                    <p>No enrollment data yet.</p>
                                </div>
                            ) : (
                                <div className="admin-trend-chart">
                                    {enrollmentTrend.map((point, i) => (
                                        <div key={i} className="admin-trend-chart__col">
                                            <div
                                                className="admin-trend-chart__bar"
                                                style={{ height: `${Math.round((point.count / maxTrend) * 100)}%` }}
                                                title={`${point.count} enrollments`}
                                            />
                                            <div className="admin-trend-chart__label">
                                                {point.month.split(' ')[0]}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Fee collection summary below chart */}
                            {stats && (
                                <div className="admin-fee-summary">
                                    <div className="admin-fee-summary__row">
                                        <span>Expected</span>
                                        <span style={{ fontWeight: 600 }}>{fmtCurrency(stats.totalExpected)}</span>
                                    </div>
                                    <div className="admin-fee-summary__row">
                                        <span>Collected</span>
                                        <span style={{ fontWeight: 600, color: '#059669' }}>
                      {fmtCurrency(stats.totalCollected)}
                    </span>
                                    </div>
                                    <div className="admin-fee-bar">
                                        <div
                                            className="admin-fee-bar__fill"
                                            style={{
                                                width: `${stats.feeCollectionRate}%`,
                                                background: stats.feeCollectionRate >= 70 ? '#059669' : '#D97706',
                                            }}
                                        />
                                    </div>
                                    <div className="admin-fee-summary__rate">
                                        {stats.feeCollectionRate}% collected
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quick actions */}
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Quick actions</span>
                            </div>
                            <div className="quick-links">
                                {[
                                    { label: 'Add new user', icon: '👤', path: '/admin/users', color: '#4F46E5', bg: '#EEF2FF' },
                                    { label: 'Create course', icon: '📚', path: '/admin/courses', color: '#0F766E', bg: '#F0FDFA' },
                                    { label: 'Manage fees', icon: '💳', path: '/admin/fees', color: '#D97706', bg: '#FFFBEB' },
                                    { label: 'Announcements', icon: '📢', path: '/announcements', color: '#DC2626', bg: '#FEF2F2' },
                                    { label: 'View reports', icon: '📊', path: '/admin/reports', color: '#7C3AED', bg: '#F5F3FF' },
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