import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from "../../components/NotificationBell";
import api from '../../api/axios';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const { user } = useSelector((s) => s.auth);

    const [dashStats, setDashStats] = useState({
        students: '—',
        teachers: '—',
        courses: '—',
        feePending: '—',
    });

    useEffect(() => {
        Promise.all([
            api.get('/users?role=student&limit=1'),
            api.get('/users?role=teacher&limit=1'),
            api.get('/courses?status=active&limit=1'),
            api.get('/fees?status=overdue&limit=1'),
        ])
            .then(([s, t, c, f]) => {
                setDashStats({
                    students: s.data.total,
                    teachers: t.data.total,
                    courses: c.data.total,
                    feePending: f.data.total,
                });
            })
            .catch((err) => {
                console.error('Failed to load dashboard stats:', err);
            });
    }, []);

    const stats = [
        { label: 'Total Students', value: dashStats.students,   sub: 'Registered',      icon: '👨‍🎓', color: '#EEF2FF', iconColor: '#4F46E5' },
        { label: 'Teachers',       value: dashStats.teachers,   sub: 'Active',           icon: '👩‍🏫', color: '#F5F3FF', iconColor: '#7C3AED' },
        { label: 'Active Courses', value: dashStats.courses,    sub: 'This semester',    icon: '📚',  color: '#F0FDFA', iconColor: '#0F766E' },
        { label: 'Fees Pending',   value: dashStats.feePending, sub: 'Unpaid invoices',  icon: '💳',  color: '#FFFBEB', iconColor: '#D97706' },
    ];

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Admin Dashboard</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <span className="badge badge-admin">Admin</span>
                    </div>
                </div>

                <div className="page-body">
                    <div className="admin-welcome">
                        <h2>Welcome, {user?.name?.split(' ')[0]} 👋</h2>
                        <p>System overview and management.</p>
                    </div>

                    <div className="stats-grid">
                        {stats.map((s) => (
                            <div className="stat-card" key={s.label}>
                                <div
                                    className="stat-card__icon"
                                    style={{ background: s.color, color: s.iconColor }}
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
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Recent Registrations</span>
                                <button className="btn btn-outline btn-sm">View all</button>
                            </div>
                            <div className="empty-state">
                                <div className="empty-state__icon">👥</div>
                                <p>No recent registrations.</p>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Quick Actions</span>
                            </div>
                            <div className="admin-quick-actions">
                                <button className="btn btn-primary btn-full">➕ Add User</button>
                                <button className="btn btn-outline btn-full">📚 Add Course</button>
                                <button className="btn btn-outline btn-full">📊 View Reports</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}