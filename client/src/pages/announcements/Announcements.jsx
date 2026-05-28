import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import {
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
} from '../../store/slices/announcementSlice';
import './Announcements.css';

const AUDIENCE_COLORS = {
    all:     { bg: '#EEF2FF', color: '#4F46E5' },
    student: { bg: '#ECFDF5', color: '#059669' },
    teacher: { bg: '#F5F3FF', color: '#7C3AED' },
    admin:   { bg: '#F0FDFA', color: '#0F766E' },
};

const EMPTY = { title: '', content: '', audience: 'all', isPinned: false, course: '' };

export default function Announcements() {
    const dispatch = useDispatch();
    const { list, total, loading } = useSelector((s) => s.announcements);
    const { user } = useSelector((s) => s.auth);
    const canCreate = ['admin', 'teacher'].includes(user?.role);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        dispatch(fetchAnnouncements({ limit: 30 }));
    }, [dispatch]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleEdit = (a) => {
        setEditing(a);
        setForm({
            title: a.title,
            content: a.content,
            audience: a.audience,
            isPinned: a.isPinned,
            course: a.course?._id || '',
        });
        setShowForm(true);
    };

    const handleNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        if (editing) {
            await dispatch(updateAnnouncement({ id: editing._id, data: form }));
        } else {
            await dispatch(createAnnouncement(form));
        }
        setSaving(false);
        setShowForm(false);
    };

    const handleDelete = (id) => {
        if (window.confirm('Delete this announcement?')) dispatch(deleteAnnouncement(id));
    };

    const handleTogglePin = (a) => {
        dispatch(updateAnnouncement({ id: a._id, data: { isPinned: !a.isPinned } }));
    };

    const timeAgo = (date) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const pinned = list.filter((a) => a.isPinned);
    const regular = list.filter((a) => !a.isPinned);

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Announcements</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{total} total</span>
                        {canCreate && (
                            <button className="btn btn-primary" onClick={handleNew}>+ New announcement</button>
                        )}
                    </div>
                </div>

                <div className="page-body" style={{ maxWidth: 800 }}>
                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
                        </div>
                    ) : list.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📢</div>
                            <p>No announcements yet.</p>
                            {canCreate && (
                                <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={handleNew}>
                                    Create first announcement
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Pinned section */}
                            {pinned.length > 0 && (
                                <div className="announcements-section">
                                    <div className="announcements-section__label">📌 Pinned</div>
                                    {pinned.map((a) => (
                                        <AnnouncementCard
                                            key={a._id}
                                            a={a}
                                            expanded={expanded === a._id}
                                            onExpand={() => setExpanded(expanded === a._id ? null : a._id)}
                                            canCreate={canCreate}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            onTogglePin={handleTogglePin}
                                            timeAgo={timeAgo}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Regular section */}
                            {regular.length > 0 && (
                                <div className="announcements-section">
                                    {pinned.length > 0 && <div className="announcements-section__label">Recent</div>}
                                    {regular.map((a) => (
                                        <AnnouncementCard
                                            key={a._id}
                                            a={a}
                                            expanded={expanded === a._id}
                                            onExpand={() => setExpanded(expanded === a._id ? null : a._id)}
                                            canCreate={canCreate}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            onTogglePin={handleTogglePin}
                                            timeAgo={timeAgo}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Form modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">{editing ? 'Edit announcement' : 'New announcement'}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <form className="modal__body" onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Title *</label>
                                <input className="form-input" name="title" value={form.title} onChange={handleChange} required placeholder="Announcement title" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Content *</label>
                                <textarea
                                    className="form-input"
                                    name="content"
                                    value={form.content}
                                    onChange={handleChange}
                                    required
                                    rows={5}
                                    placeholder="Write your announcement here…"
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Audience</label>
                                    <select className="form-input" name="audience" value={form.audience} onChange={handleChange}>
                                        <option value="all">Everyone</option>
                                        <option value="student">Students only</option>
                                        <option value="teacher">Teachers only</option>
                                        <option value="admin">Admins only</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.875rem', paddingBottom: '10px' }}>
                                        <input type="checkbox" name="isPinned" checked={form.isPinned} onChange={handleChange} />
                                        📌 Pin this announcement
                                    </label>
                                </div>
                            </div>

                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner"></span> Saving…</> : editing ? 'Update' : 'Publish'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function AnnouncementCard({ a, expanded, onExpand, canCreate, onEdit, onDelete, onTogglePin, timeAgo }) {
    const ac = AUDIENCE_COLORS[a.audience] || AUDIENCE_COLORS.all;

    return (
        <div className={`announcement-card card ${a.isPinned ? 'announcement-card--pinned' : ''}`}>
            <div className="announcement-card__header">
                <div className="announcement-card__meta">
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: ac.bg, color: ac.color, textTransform: 'capitalize' }}>
            {a.audience === 'all' ? 'Everyone' : a.audience}
          </span>
                    {a.course && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>📚 {a.course.code}</span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{timeAgo(a.createdAt)}</span>
                </div>

                {canCreate && (
                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onTogglePin(a)} title={a.isPinned ? 'Unpin' : 'Pin'}>
                            {a.isPinned ? '📌' : '📍'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(a)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => onDelete(a._id)}>Delete</button>
                    </div>
                )}
            </div>

            <h3 className="announcement-card__title">{a.title}</h3>

            <div className={`announcement-card__content ${expanded ? 'expanded' : ''}`}>
                {a.content}
            </div>

            {a.content.length > 200 && (
                <button className="announcement-card__toggle" onClick={onExpand}>
                    {expanded ? 'Show less ↑' : 'Read more ↓'}
                </button>
            )}

            <div className="announcement-card__footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                        {a.author?.name?.charAt(0)}
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            {a.author?.name} · <span style={{ textTransform: 'capitalize' }}>{a.author?.role}</span>
          </span>
                </div>
            </div>
        </div>
    );
}