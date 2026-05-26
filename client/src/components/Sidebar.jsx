import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';

const NAV_ITEMS = {
    student: [
        { label: 'Dashboard', icon: '⊞', path: '/student/dashboard' },
        { label: 'My Courses', icon: '📚', path: '/student/courses' },
        { label: 'Attendance', icon: '✅', path: '/student/attendance' },
        { label: 'Grades', icon: '📊', path: '/student/grades' },
        { label: 'Timetable', icon: '🗓', path: '/student/timetable' },
    ],
    teacher: [
        { label: 'Dashboard', icon: '⊞', path: '/teacher/dashboard' },
        { label: 'My Classes', icon: '🎓', path: '/teacher/classes' },
        { label: 'Attendance', icon: '✅', path: '/teacher/attendance' },
        { label: 'Assignments', icon: '📝', path: '/teacher/assignments' },
        { label: 'Grades', icon: '📊', path: '/teacher/grades' },
    ],
    admin: [
        { label: 'Dashboard', icon: '⊞', path: '/admin/dashboard' },
        { label: 'Users', icon: '👥', path: '/admin/users' },
        { label: 'Courses', icon: '📚', path: '/admin/courses' },
        { label: 'Fees', icon: '💳', path: '/admin/fees' },
        { label: 'Reports', icon: '📈', path: '/admin/reports' },
    ],
};

export default function Sidebar() {
    const { user } = useSelector((s) => s.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const items = NAV_ITEMS[user?.role] || [];
    const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar__logo">
                <div className="sidebar__logo-icon">S</div>
                <div>
                    <div className="sidebar__logo-text">School ERP</div>
                    <div className="sidebar__logo-sub">Management System</div>
                </div>
            </div>

            <nav className="sidebar__nav">
                <div className="sidebar__section-title">Menu</div>
                {items.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `sidebar__item${isActive ? ' active' : ''}`
                        }
                    >
                        <span className="sidebar__item-icon">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar__footer">
                <div className="sidebar__user">
                    <div className="sidebar__avatar">{initials}</div>
                    <div className="sidebar__user-info">
                        <div className="sidebar__user-name">{user?.name}</div>
                        <div className="sidebar__user-role">{user?.role}</div>
                    </div>
                    <button className="sidebar__logout" onClick={handleLogout} title="Sign out">
                        ⏻
                    </button>
                </div>
            </div>
        </aside>
    );
}