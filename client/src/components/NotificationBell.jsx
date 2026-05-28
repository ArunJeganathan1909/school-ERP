import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    fetchNotifications,
    markRead,
    markAllRead,
    clearAllNotifications,
} from '../store/slices/notificationSlice';
import './NotificationBell.css';

const TYPE_ICON = {
    assignment_due:     '📝',
    assignment_graded:  '📊',
    quiz_available:     '📋',
    grade_posted:       '🎯',
    fee_reminder:       '💳',
    fee_paid:           '✅',
    attendance_marked:  '✔',
    announcement:       '📢',
    enrollment:         '🎓',
    system:             '🔔',
};

export default function NotificationBell() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { list, unreadCount, loading } = useSelector((s) => s.notifications);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        dispatch(fetchNotifications({ limit: 20 }));
    }, [dispatch]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleClick = (n) => {
        if (!n.isRead) dispatch(markRead(n._id));
        if (n.link) navigate(n.link);
        setOpen(false);
    };

    const handleMarkAll = (e) => {
        e.stopPropagation();
        dispatch(markAllRead());
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (window.confirm('Clear all notifications?')) dispatch(clearAllNotifications());
    };

    const timeAgo = (date) => {
        const diff = Date.now() - new Date(date).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    };

    return (
        <div className="notif-bell" ref={ref}>
            <button
                className="notif-bell__btn"
                onClick={() => setOpen((o) => !o)}
                aria-label={`${unreadCount} unread notifications`}
            >
                🔔
                {unreadCount > 0 && (
                    <span className="notif-bell__badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
                )}
            </button>

            {open && (
                <div className="notif-dropdown">
                    <div className="notif-dropdown__header">
                        <span className="notif-dropdown__title">Notifications</span>
                        <div className="notif-dropdown__actions">
                            {unreadCount > 0 && (
                                <button className="notif-action-btn" onClick={handleMarkAll}>
                                    Mark all read
                                </button>
                            )}
                            {list.length > 0 && (
                                <button className="notif-action-btn notif-action-btn--danger" onClick={handleClear}>
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="notif-dropdown__list">
                        {loading && list.length === 0 ? (
                            <div className="notif-empty">
                                <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5', width: 20, height: 20, borderWidth: 2 }}></div>
                            </div>
                        ) : list.length === 0 ? (
                            <div className="notif-empty">
                                <span style={{ fontSize: '2rem' }}>🔔</span>
                                <p>All caught up!</p>
                            </div>
                        ) : (
                            list.map((n) => (
                                <div
                                    key={n._id}
                                    className={`notif-item ${!n.isRead ? 'notif-item--unread' : ''}`}
                                    onClick={() => handleClick(n)}
                                >
                                    <div className="notif-item__icon">{TYPE_ICON[n.type] || '🔔'}</div>
                                    <div className="notif-item__body">
                                        <p className="notif-item__title">{n.title}</p>
                                        <p className="notif-item__msg">{n.message}</p>
                                        <p className="notif-item__time">{timeAgo(n.createdAt)}</p>
                                    </div>
                                    {!n.isRead && <div className="notif-item__dot" />}
                                </div>
                            ))
                        )}
                    </div>

                    {list.length > 0 && (
                        <div className="notif-dropdown__footer">
                            <button
                                className="notif-action-btn"
                                onClick={() => { navigate('/notifications'); setOpen(false); }}
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}