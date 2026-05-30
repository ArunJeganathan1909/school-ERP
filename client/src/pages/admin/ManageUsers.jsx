import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import api from '../../api/axios';
import './ManageUsers.css';

const ROLES = ['student', 'teacher', 'admin'];

const ROLE_STYLES = {
    student: { bg: '#EEF2FF', color: '#4F46E5' },
    teacher: { bg: '#F5F3FF', color: '#7C3AED' },
    admin:   { bg: '#F0FDFA', color: '#0F766E' },
};

const EMPTY_FORM = {
    name: '', email: '', password: '',
    role: 'student', phone: '', isActive: true,
};

export default function ManageUsers() {
    const { user: currentUser } = useSelector((s) => s.auth);

    const [users, setUsers]         = useState([]);
    const [total, setTotal]         = useState(0);
    const [pages, setPages]         = useState(1);
    const [page, setPage]           = useState(1);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');

    // Filters
    const [search, setSearch]       = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatus] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser]   = useState(null);   // null = create
    const [form, setForm]           = useState(EMPTY_FORM);
    const [saving, setSaving]       = useState(false);
    const [formError, setFormError] = useState('');

    // View modal
    const [viewUser, setViewUser]   = useState(null);

    // Delete confirm
    const [deletingId, setDeletingId] = useState(null);

    /* ── fetch ── */
    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page, limit: 15 });
            if (search)       params.append('search', search);
            if (roleFilter)   params.append('role', roleFilter);
            if (statusFilter) params.append('isActive', statusFilter === 'active' ? 'true' : 'false');

            const { data } = await api.get(`/users?${params}`);
            setUsers(data.users);
            setTotal(data.total);
            setPages(data.pages);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load users');
        }
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, [page, roleFilter, statusFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchUsers();
    };

    /* ── modal helpers ── */
    const openCreate = () => {
        setEditUser(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setShowModal(true);
    };

    const openEdit = (u) => {
        setEditUser(u);
        setForm({
            name:     u.name,
            email:    u.email,
            password: '',
            role:     u.role,
            phone:    u.phone || '',
            isActive: u.isActive,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');
        try {
            if (editUser) {
                // Update existing
                const payload = { name: form.name, phone: form.phone, role: form.role, isActive: form.isActive };
                if (form.password) payload.newPassword = form.password;
                await api.put(`/users/${editUser._id}`, payload);
            } else {
                // Register new user (admins can set any role)
                await api.post('/auth/register', {
                    name: form.name, email: form.email,
                    password: form.password, role: form.role,
                });
            }
            setShowModal(false);
            setPage(1);
            fetchUsers();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Save failed');
        }
        setSaving(false);
    };

    /* ── toggle active ── */
    const handleToggleActive = async (u) => {
        try {
            await api.put(`/users/${u._id}`, { isActive: !u.isActive });
            setUsers((prev) =>
                prev.map((x) => x._id === u._id ? { ...x, isActive: !u.isActive } : x)
            );
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update status');
        }
    };

    /* ── delete ── */
    const handleDelete = async (id) => {
        if (!window.confirm('Permanently delete this user? This cannot be undone.')) return;
        setDeletingId(id);
        try {
            await api.delete(`/users/${id}`);
            setUsers((prev) => prev.filter((u) => u._id !== id));
            setTotal((t) => t - 1);
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
        setDeletingId(null);
    };

    /* ── UI helpers ── */
    const initials = (name) =>
        name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

    const formatDate = (d) =>
        new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const roleCounts = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">

                {/* Topbar */}
                <div className="topbar">
                    <h1 className="topbar__title">User management</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <button className="btn btn-primary" onClick={openCreate}>
                            + Add user
                        </button>
                    </div>
                </div>

                <div className="page-body">

                    {/* Summary strip */}
                    <div className="user-summary-strip">
                        <div className="user-summary-strip__item">
                            <span className="user-summary-strip__val">{total}</span>
                            <span className="user-summary-strip__label">Total users</span>
                        </div>
                        {ROLES.map((r) => (
                            <div key={r} className="user-summary-strip__item">
                <span
                    className="user-summary-strip__val"
                    style={{ color: ROLE_STYLES[r].color }}
                >
                  {roleCounts[r] || 0}
                </span>
                                <span className="user-summary-strip__label" style={{ textTransform: 'capitalize' }}>
                  {r}s
                </span>
                            </div>
                        ))}
                        <div className="user-summary-strip__item">
              <span className="user-summary-strip__val" style={{ color: '#059669' }}>
                {users.filter((u) => u.isActive).length}
              </span>
                            <span className="user-summary-strip__label">Active</span>
                        </div>
                        <div className="user-summary-strip__item">
              <span className="user-summary-strip__val" style={{ color: '#DC2626' }}>
                {users.filter((u) => !u.isActive).length}
              </span>
                            <span className="user-summary-strip__label">Inactive</span>
                        </div>
                    </div>

                    {/* Filters row */}
                    <div className="user-filters">
                        <form className="user-filters__search" onSubmit={handleSearch}>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Search by name or email…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary btn-sm">Search</button>
                            {search && (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => { setSearch(''); setPage(1); setTimeout(fetchUsers, 0); }}
                                >
                                    Clear
                                </button>
                            )}
                        </form>

                        <div className="user-filters__tabs">
                            {/* Role filter */}
                            {['', ...ROLES].map((r) => (
                                <button
                                    key={r || 'all'}
                                    className={`course-status-tab ${roleFilter === r ? 'active' : ''}`}
                                    onClick={() => { setRoleFilter(r); setPage(1); }}
                                    style={r && roleFilter === r
                                        ? { background: ROLE_STYLES[r].color, borderColor: ROLE_STYLES[r].color }
                                        : {}
                                    }
                                >
                                    {r || 'All roles'}
                                </button>
                            ))}
                        </div>

                        <div className="user-filters__tabs">
                            {/* Status filter */}
                            {[
                                { val: '', label: 'All status' },
                                { val: 'active', label: '✓ Active' },
                                { val: 'inactive', label: '✕ Inactive' },
                            ].map((s) => (
                                <button
                                    key={s.val}
                                    className={`course-status-tab ${statusFilter === s.val ? 'active' : ''}`}
                                    onClick={() => { setStatus(s.val); setPage(1); }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                            {error}
                        </div>
                    )}

                    {/* Table */}
                    {loading ? (
                        <div className="empty-state">
                            <div
                                className="spinner"
                                style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}
                            />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">👥</div>
                            <p>No users found.</p>
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreate}>
                                Add first user
                            </button>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Phone</th>
                                    <th>Joined</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {users.map((u) => {
                                    const rs = ROLE_STYLES[u.role];
                                    const isSelf = u._id === currentUser?._id;
                                    return (
                                        <tr key={u._id}>
                                            {/* User info */}
                                            <td>
                                                <div className="user-table-cell">
                                                    <div
                                                        className="user-table-cell__avatar"
                                                        style={{ background: rs.bg, color: rs.color }}
                                                    >
                                                        {u.profilePhoto
                                                            ? <img src={u.profilePhoto} alt={u.name} />
                                                            : initials(u.name)
                                                        }
                                                    </div>
                                                    <div>
                                                        <div className="user-table-cell__name">
                                                            {u.name}
                                                            {isSelf && (
                                                                <span className="user-table-cell__you">you</span>
                                                            )}
                                                        </div>
                                                        <div className="user-table-cell__email">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role badge */}
                                            <td>
                          <span
                              className="badge"
                              style={{ background: rs.bg, color: rs.color, textTransform: 'capitalize' }}
                          >
                            {u.role}
                          </span>
                                            </td>

                                            {/* Phone */}
                                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                                                {u.phone || '—'}
                                            </td>

                                            {/* Joined date */}
                                            <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                                                {formatDate(u.createdAt)}
                                            </td>

                                            {/* Status toggle */}
                                            <td>
                                                <button
                                                    className={`user-status-toggle ${u.isActive ? 'active' : 'inactive'}`}
                                                    onClick={() => !isSelf && handleToggleActive(u)}
                                                    disabled={isSelf}
                                                    title={isSelf ? "You can't deactivate yourself" : u.isActive ? 'Click to deactivate' : 'Click to activate'}
                                                >
                                                    <span className="user-status-toggle__dot" />
                                                    {u.isActive ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>

                                            {/* Actions */}
                                            <td>
                                                <div className="user-actions">
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setViewUser(u)}
                                                        title="View profile"
                                                    >
                                                        👁
                                                    </button>
                                                    <button
                                                        className="btn btn-outline btn-sm"
                                                        onClick={() => openEdit(u)}
                                                        title="Edit user"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleDelete(u._id)}
                                                        disabled={isSelf || deletingId === u._id}
                                                        title={isSelf ? "You can't delete yourself" : 'Delete user'}
                                                    >
                                                        {deletingId === u._id ? '…' : 'Del'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="course-list__pagination" style={{ marginTop: 'var(--space-lg)' }}>
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                ← Prev
                            </button>
                            <span className="pagination__info">Page {page} of {pages} · {total} users</span>
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                                disabled={page === pages}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create / Edit Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">
                                {editUser ? `Edit — ${editUser.name}` : 'Add new user'}
                            </h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        {formError && (
                            <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                                {formError}
                            </div>
                        )}

                        <form className="modal__body" onSubmit={handleSave}>
                            {/* Name + Role */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Full name *</label>
                                    <input
                                        className="form-input"
                                        name="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        required
                                        placeholder="Full name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role *</label>
                                    <select className="form-input" name="role" value={form.role} onChange={handleChange}>
                                        {ROLES.map((r) => (
                                            <option key={r} value={r} style={{ textTransform: 'capitalize' }}>
                                                {r.charAt(0).toUpperCase() + r.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Email — readonly when editing */}
                            <div className="form-group">
                                <label className="form-label">Email address *</label>
                                <input
                                    className="form-input"
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    required={!editUser}
                                    placeholder="user@school.com"
                                    readOnly={!!editUser}
                                    style={editUser ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : {}}
                                />
                                {editUser && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        Email cannot be changed after registration.
                                    </p>
                                )}
                            </div>

                            {/* Phone */}
                            <div className="form-group">
                                <label className="form-label">Phone number</label>
                                <input
                                    className="form-input"
                                    name="phone"
                                    value={form.phone}
                                    onChange={handleChange}
                                    placeholder="+94 77 123 4567"
                                />
                            </div>

                            {/* Password */}
                            <div className="form-group">
                                <label className="form-label">
                                    {editUser ? 'New password (leave blank to keep current)' : 'Password *'}
                                </label>
                                <input
                                    className="form-input"
                                    type="password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    required={!editUser}
                                    placeholder={editUser ? 'Leave blank to keep current password' : 'Min. 6 characters'}
                                    minLength={form.password ? 6 : undefined}
                                />
                            </div>

                            {/* Active toggle — only when editing */}
                            {editUser && (
                                <label className="user-active-toggle-label">
                                    <input
                                        type="checkbox"
                                        name="isActive"
                                        checked={form.isActive}
                                        onChange={handleChange}
                                        disabled={editUser._id === currentUser?._id}
                                    />
                                    <span>Account is active</span>
                                    {editUser._id === currentUser?._id && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      (you cannot deactivate yourself)
                    </span>
                                    )}
                                </label>
                            )}

                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving
                                        ? <><span className="spinner"></span> Saving…</>
                                        : editUser ? 'Save changes' : 'Create user'
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── View Profile Modal ── */}
            {viewUser && (
                <div className="modal-overlay" onClick={() => setViewUser(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">User profile</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setViewUser(null)}>✕</button>
                        </div>
                        <div className="modal__body">
                            {/* Avatar + name */}
                            <div className="user-profile-hero">
                                <div
                                    className="user-profile-hero__avatar"
                                    style={{
                                        background: ROLE_STYLES[viewUser.role].bg,
                                        color: ROLE_STYLES[viewUser.role].color,
                                    }}
                                >
                                    {viewUser.profilePhoto
                                        ? <img src={viewUser.profilePhoto} alt={viewUser.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        : initials(viewUser.name)
                                    }
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{viewUser.name}</h3>
                                    <span
                                        className="badge"
                                        style={{ background: ROLE_STYLES[viewUser.role].bg, color: ROLE_STYLES[viewUser.role].color, textTransform: 'capitalize', marginTop: 4 }}
                                    >
                    {viewUser.role}
                  </span>
                                </div>
                            </div>

                            <hr className="divider" />

                            {/* Details */}
                            <div className="user-profile-details">
                                {[
                                    { label: 'Email',    value: viewUser.email },
                                    { label: 'Phone',    value: viewUser.phone || '—' },
                                    { label: 'Status',   value: viewUser.isActive ? 'Active' : 'Inactive', color: viewUser.isActive ? '#059669' : '#DC2626' },
                                    { label: 'Joined',   value: formatDate(viewUser.createdAt) },
                                    { label: 'Last updated', value: formatDate(viewUser.updatedAt) },
                                    { label: 'User ID',  value: viewUser._id, mono: true },
                                ].map(({ label, value, color, mono }) => (
                                    <div key={label} className="user-profile-details__row">
                                        <span className="user-profile-details__label">{label}</span>
                                        <span
                                            className="user-profile-details__value"
                                            style={{
                                                color: color || 'var(--color-text-primary)',
                                                fontFamily: mono ? 'var(--font-mono)' : 'inherit',
                                                fontSize: mono ? '0.75rem' : '0.875rem',
                                                wordBreak: 'break-all',
                                            }}
                                        >
                      {value}
                    </span>
                                    </div>
                                ))}
                            </div>

                            <div className="modal__footer">
                                <button className="btn btn-ghost" onClick={() => setViewUser(null)}>Close</button>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => { setViewUser(null); openEdit(viewUser); }}
                                >
                                    Edit user
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}