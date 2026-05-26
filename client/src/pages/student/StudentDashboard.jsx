import { useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import './StudentDashboard.css';

const stats = [
    { label: 'Enrolled Courses', value: '—', sub: 'This semester', icon: '📚', color: '#EEF2FF', iconColor: '#4F46E5' },
    { label: 'Attendance', value: '—%', sub: 'Overall rate', icon: '✅', color: '#ECFDF5', iconColor: '#059669' },
    { label: 'Assignments', value: '—', sub: 'Pending', icon: '📝', color: '#FFFBEB', iconColor: '#D97706' },
    { label: 'GPA', value: '—', sub: 'Current semester', icon: '📊', color: '#F5F3FF', iconColor: '#7C3AED' },
];

export default function StudentDashboard() {
    const { user } = useSelector((s) => s.auth);

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Dashboard</h1>
                    <div className="topbar__right">
                        <span className="badge badge-student">Student</span>
                    </div>
                </div>

                <div className="page-body">
                    <div className="student-welcome">
                        <h2>Good morning, {user?.name?.split(' ')[0]} 👋</h2>
                        <p>Here's what's happening with your studies today.</p>
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
                                <span className="card-title">Recent Courses</span>
                                <button className="btn btn-outline btn-sm">View all</button>
                            </div>
                            <div className="empty-state">
                                <div className="empty-state__icon">📚</div>
                                <p>No courses enrolled yet.</p>
                                <p>Courses will appear here once you're enrolled.</p>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">Upcoming</span>
                            </div>
                            <div className="empty-state">
                                <div className="empty-state__icon">🗓</div>
                                <p>No upcoming events.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}