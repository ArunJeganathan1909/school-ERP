import { useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from "../../components/NotificationBell";
import './TeacherDashboard.css';

const stats = [
    { label: 'My Classes', value: '—', sub: 'Active', icon: '🎓', color: '#F5F3FF', iconColor: '#7C3AED' },
    { label: 'Total Students', value: '—', sub: 'Across all classes', icon: '👥', color: '#EEF2FF', iconColor: '#4F46E5' },
    { label: 'Assignments', value: '—', sub: 'Active', icon: '📝', color: '#FFFBEB', iconColor: '#D97706' },
    { label: "Today's Classes", value: '—', sub: 'Scheduled', icon: '📅', color: '#ECFDF5', iconColor: '#059669' },
];

export default function TeacherDashboard() {
    const { user } = useSelector((s) => s.auth);

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Dashboard</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <span className="badge badge-teacher">Teacher</span>
                    </div>
                </div>

                <div className="page-body">
                    <div className="teacher-welcome">
                        <h2>Hello, {user?.name?.split(' ')[0]} 👋</h2>
                        <p>Here's your teaching overview for today.</p>
                    </div>

                    <div className="stats-grid">
                        {stats.map((s) => (
                            <div className="stat-card" key={s.label}>
                                <div className="stat-card__icon" style={{ background: s.color, color: s.iconColor }}>
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
                                <span className="card-title">My Classes</span>
                                <button className="btn btn-outline btn-sm">View all</button>
                            </div>
                            <div className="empty-state">
                                <div className="empty-state__icon">🎓</div>
                                <p>No classes assigned yet.</p>
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Pending Reviews</span>
                            </div>
                            <div className="empty-state">
                                <div className="empty-state__icon">📝</div>
                                <p>No submissions to review.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}