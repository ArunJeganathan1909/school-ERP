import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import api from '../../api/axios';
import './ManageSubjects.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_FORM = {
    name:        '',
    code:        '',
    course:      '',
    teacher:     '',
    credits:     3,
    description: '',
    semester:    1,
    isElective:  false,
    schedule:    [],
};

const EMPTY_SCHEDULE = {
    day:       'Monday',
    startTime: '09:00',
    endTime:   '10:30',
    room:      '',
};

export default function ManageSubjects() {
    const navigate = useNavigate();
    const { user } = useSelector((s) => s.auth);

    // Data
    const [subjects,  setSubjects]  = useState([]);
    const [courses,   setCourses]   = useState([]);
    const [teachers,  setTeachers]  = useState([]);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState('');

    // Filters
    const [filterCourse,   setFilterCourse]   = useState('');
    const [filterSemester, setFilterSemester] = useState('');
    const [search,         setSearch]         = useState('');

    // Modal
    const [showModal,  setShowModal]  = useState(false);
    const [editSubject, setEditSubject] = useState(null);
    const [form,       setForm]       = useState(EMPTY_FORM);
    const [saving,     setSaving]     = useState(false);
    const [formError,  setFormError]  = useState('');

    // View modal
    const [viewSubject, setViewSubject] = useState(null);

    // Delete
    const [deletingId, setDeletingId] = useState(null);

    /* ── initial data fetch ── */
    useEffect(() => {
        fetchCourses();
        fetchTeachers();
    }, []);

    useEffect(() => {
        fetchSubjects();
    }, [filterCourse, filterSemester]);

    /* ── API helpers ── */
    const fetchSubjects = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (filterCourse)   params.append('course', filterCourse);
            if (filterSemester) params.append('semester', filterSemester);

            const { data } = await api.get(`/subjects?${params}`);
            setSubjects(data.subjects || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load subjects');
        }
        setLoading(false);
    };

    const fetchCourses = async () => {
        try {
            const { data } = await api.get('/courses?limit=100&status=active');
            setCourses(data.courses || []);
        } catch { setCourses([]); }
    };

    const fetchTeachers = async () => {
        try {
            const { data } = await api.get('/users?role=teacher&limit=100');
            setTeachers(data.users || []);
        } catch { setTeachers([]); }
    };

    /* ── modal helpers ── */
    const openCreate = () => {
        setEditSubject(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setShowModal(true);
    };

    const openEdit = (subject) => {
        setEditSubject(subject);
        setForm({
            name:        subject.name        || '',
            code:        subject.code        || '',
            course:      subject.course?._id || subject.course || '',
            teacher:     subject.teacher?._id || subject.teacher || '',
            credits:     subject.credits     ?? 3,
            description: subject.description || '',
            semester:    subject.semester    ?? 1,
            isElective:  subject.isElective  || false,
            schedule:    subject.schedule    || [],
        });
        setFormError('');
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    /* ── schedule slot helpers ── */
    const addScheduleSlot = () => {
        setForm((f) => ({ ...f, schedule: [...f.schedule, { ...EMPTY_SCHEDULE }] }));
    };

    const removeScheduleSlot = (idx) => {
        setForm((f) => ({ ...f, schedule: f.schedule.filter((_, i) => i !== idx) }));
    };

    const updateScheduleSlot = (idx, field, value) => {
        setForm((f) => {
            const updated = [...f.schedule];
            updated[idx] = { ...updated[idx], [field]: value };
            return { ...f, schedule: updated };
        });
    };

    /* ── save ── */
    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');

        const payload = {
            ...form,
            teacher: form.teacher || null,
            credits: Number(form.credits),
            semester: Number(form.semester),
        };

        try {
            if (editSubject) {
                await api.put(`/subjects/${editSubject._id}`, payload);
            } else {
                await api.post('/subjects', payload);
            }
            setShowModal(false);
            fetchSubjects();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Save failed');
        }
        setSaving(false);
    };

    /* ── delete ── */
    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete subject "${name}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            await api.delete(`/subjects/${id}`);
            setSubjects((prev) => prev.filter((s) => s._id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
        setDeletingId(null);
    };

    /* ── search filter (client-side on loaded data) ── */
    const filtered = subjects.filter((s) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            s.name?.toLowerCase().includes(q) ||
            s.code?.toLowerCase().includes(q) ||
            s.teacher?.name?.toLowerCase().includes(q)
        );
    });

    /* ── course name lookup ── */
    const courseName = (id) => courses.find((c) => c._id === id)?.title || '—';

    /* ── day color ── */
    const DAY_COLORS = {
        Monday:    '#EEF2FF',
        Tuesday:   '#F5F3FF',
        Wednesday: '#ECFDF5',
        Thursday:  '#FFF7ED',
        Friday:    '#FEF2F2',
        Saturday:  '#F0F9FF',
    };
    const DAY_TEXT = {
        Monday:    '#4F46E5',
        Tuesday:   '#7C3AED',
        Wednesday: '#059669',
        Thursday:  '#EA580C',
        Friday:    '#DC2626',
        Saturday:  '#0284C7',
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">

                {/* Topbar */}
                <div className="topbar">
                    <h1 className="topbar__title">Subject management</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        {user?.role === 'admin' && (
                            <button className="btn btn-primary" onClick={openCreate}>
                                + Add subject
                            </button>
                        )}
                    </div>
                </div>

                <div className="page-body">

                    {/* Stats strip */}
                    <div className="subject-stats-strip">
                        <div className="subject-stats-strip__item">
                            <span className="subject-stats-strip__val">{subjects.length}</span>
                            <span className="subject-stats-strip__label">Total subjects</span>
                        </div>
                        <div className="subject-stats-strip__item">
              <span className="subject-stats-strip__val" style={{ color: '#4F46E5' }}>
                {subjects.filter((s) => !s.isElective).length}
              </span>
                            <span className="subject-stats-strip__label">Core</span>
                        </div>
                        <div className="subject-stats-strip__item">
              <span className="subject-stats-strip__val" style={{ color: '#7C3AED' }}>
                {subjects.filter((s) => s.isElective).length}
              </span>
                            <span className="subject-stats-strip__label">Elective</span>
                        </div>
                        <div className="subject-stats-strip__item">
              <span className="subject-stats-strip__val" style={{ color: '#059669' }}>
                {subjects.filter((s) => s.teacher).length}
              </span>
                            <span className="subject-stats-strip__label">Assigned</span>
                        </div>
                        <div className="subject-stats-strip__item">
              <span className="subject-stats-strip__val" style={{ color: '#D97706' }}>
                {subjects.filter((s) => !s.teacher).length}
              </span>
                            <span className="subject-stats-strip__label">Unassigned</span>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="subject-filters">
                        {/* Search */}
                        <input
                            className="form-input"
                            style={{ flex: 1, minWidth: 200, maxWidth: 320 }}
                            type="text"
                            placeholder="Search by name, code or teacher…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        {/* Course filter */}
                        <select
                            className="form-input subject-filters__select"
                            value={filterCourse}
                            onChange={(e) => { setFilterCourse(e.target.value); }}
                        >
                            <option value="">All courses</option>
                            {courses.map((c) => (
                                <option key={c._id} value={c._id}>{c.title} ({c.code})</option>
                            ))}
                        </select>

                        {/* Semester filter */}
                        <select
                            className="form-input subject-filters__select"
                            value={filterSemester}
                            onChange={(e) => setFilterSemester(e.target.value)}
                        >
                            <option value="">All semesters</option>
                            {[1, 2, 3, 4, 5, 6].map((s) => (
                                <option key={s} value={s}>Semester {s}</option>
                            ))}
                        </select>

                        {(filterCourse || filterSemester || search) && (
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => { setFilterCourse(''); setFilterSemester(''); setSearch(''); }}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                            {error}
                        </div>
                    )}

                    {/* Content */}
                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📖</div>
                            <p>{subjects.length === 0 ? 'No subjects yet.' : 'No subjects match your filters.'}</p>
                            {user?.role === 'admin' && subjects.length === 0 && (
                                <button
                                    className="btn btn-primary"
                                    style={{ marginTop: 'var(--space-md)' }}
                                    onClick={openCreate}
                                >
                                    Add first subject
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="subject-grid">
                            {filtered.map((subject) => (
                                <SubjectCard
                                    key={subject._id}
                                    subject={subject}
                                    canManage={user?.role === 'admin'}
                                    DAY_COLORS={DAY_COLORS}
                                    DAY_TEXT={DAY_TEXT}
                                    onView={() => setViewSubject(subject)}
                                    onEdit={() => openEdit(subject)}
                                    onDelete={() => handleDelete(subject._id, subject.name)}
                                    deleting={deletingId === subject._id}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create / Edit Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div
                        className="modal"
                        style={{ maxWidth: 680 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal__header">
                            <h2 className="modal__title">
                                {editSubject ? `Edit — ${editSubject.name}` : 'Add new subject'}
                            </h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        {formError && (
                            <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                                {formError}
                            </div>
                        )}

                        <form className="modal__body" onSubmit={handleSave}>

                            {/* Name + Code */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Subject name *</label>
                                    <input
                                        className="form-input"
                                        name="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. Introduction to Programming"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subject code *</label>
                                    <input
                                        className="form-input"
                                        name="code"
                                        value={form.code}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. BCS101-S1"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
                            </div>

                            {/* Course + Teacher */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Course *</label>
                                    <select
                                        className="form-input"
                                        name="course"
                                        value={form.course}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select course</option>
                                        {courses.map((c) => (
                                            <option key={c._id} value={c._id}>
                                                {c.title} ({c.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Assign teacher</label>
                                    <select
                                        className="form-input"
                                        name="teacher"
                                        value={form.teacher}
                                        onChange={handleChange}
                                    >
                                        <option value="">— No teacher assigned —</option>
                                        {teachers.map((t) => (
                                            <option key={t._id} value={t._id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Credits + Semester */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Credits</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        name="credits"
                                        value={form.credits}
                                        onChange={handleChange}
                                        min={1}
                                        max={10}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Semester</label>
                                    <select
                                        className="form-input"
                                        name="semester"
                                        value={form.semester}
                                        onChange={handleChange}
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                            <option key={s} value={s}>Semester {s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-input"
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows={2}
                                    placeholder="Brief subject description…"
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            {/* Elective toggle */}
                            <label className="subject-modal-toggle">
                                <input
                                    type="checkbox"
                                    name="isElective"
                                    checked={form.isElective}
                                    onChange={handleChange}
                                />
                                <span>This is an elective subject</span>
                            </label>

                            {/* Schedule slots */}
                            <div className="subject-schedule-section">
                                <div className="subject-schedule-section__header">
                  <span className="form-label" style={{ margin: 0 }}>
                    Class schedule
                  </span>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={addScheduleSlot}
                                    >
                                        + Add slot
                                    </button>
                                </div>

                                {form.schedule.length === 0 ? (
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: 'var(--space-sm) 0' }}>
                                        No schedule set. Click "+ Add slot" to add class timings.
                                    </p>
                                ) : (
                                    <div className="subject-schedule-slots">
                                        {form.schedule.map((slot, idx) => (
                                            <div key={idx} className="subject-schedule-slot">
                                                {/* Day */}
                                                <select
                                                    className="form-input"
                                                    value={slot.day}
                                                    onChange={(e) => updateScheduleSlot(idx, 'day', e.target.value)}
                                                >
                                                    {DAYS.map((d) => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>

                                                {/* Start time */}
                                                <input
                                                    className="form-input"
                                                    type="time"
                                                    value={slot.startTime}
                                                    onChange={(e) => updateScheduleSlot(idx, 'startTime', e.target.value)}
                                                />

                                                <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, flexShrink: 0 }}>
                          to
                        </span>

                                                {/* End time */}
                                                <input
                                                    className="form-input"
                                                    type="time"
                                                    value={slot.endTime}
                                                    onChange={(e) => updateScheduleSlot(idx, 'endTime', e.target.value)}
                                                />

                                                {/* Room */}
                                                <input
                                                    className="form-input"
                                                    type="text"
                                                    value={slot.room}
                                                    onChange={(e) => updateScheduleSlot(idx, 'room', e.target.value)}
                                                    placeholder="Room"
                                                />

                                                {/* Remove */}
                                                <button
                                                    type="button"
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => removeScheduleSlot(idx)}
                                                    style={{ flexShrink: 0 }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="modal__footer">
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving
                                        ? <><span className="spinner"></span> Saving…</>
                                        : editSubject ? 'Update subject' : 'Create subject'
                                    }
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

            {/* ── View Subject Modal ── */}
            {viewSubject && (
                <div className="modal-overlay" onClick={() => setViewSubject(null)}>
                    <div
                        className="modal"
                        style={{ maxWidth: 480 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal__header">
                            <h2 className="modal__title">Subject details</h2>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setViewSubject(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal__body">

                            {/* Header */}
                            <div className="subject-view-hero">
                                <div className="subject-view-hero__icon">📖</div>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                                        {viewSubject.name}
                                    </h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ background: '#EEF2FF', color: '#4F46E5', fontWeight: 700, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {viewSubject.code}
                    </span>
                                        <span style={{ background: viewSubject.isElective ? '#F5F3FF' : '#ECFDF5', color: viewSubject.isElective ? '#7C3AED' : '#059669', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {viewSubject.isElective ? 'Elective' : 'Core'}
                    </span>
                                        <span style={{ background: '#FFF7ED', color: '#EA580C', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      Semester {viewSubject.semester}
                    </span>
                                    </div>
                                </div>
                            </div>

                            <hr className="divider" />

                            {/* Details */}
                            <div className="user-profile-details">
                                {[
                                    { label: 'Course',    value: viewSubject.course?.title || '—' },
                                    { label: 'Teacher',   value: viewSubject.teacher?.name || 'Unassigned' },
                                    { label: 'Credits',   value: `${viewSubject.credits} credits` },
                                    { label: 'Semester',  value: `Semester ${viewSubject.semester}` },
                                    { label: 'Type',      value: viewSubject.isElective ? 'Elective' : 'Core' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="user-profile-details__row">
                                        <span className="user-profile-details__label">{label}</span>
                                        <span className="user-profile-details__value">{value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Description */}
                            {viewSubject.description && (
                                <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                    {viewSubject.description}
                                </div>
                            )}

                            {/* Schedule */}
                            {viewSubject.schedule?.length > 0 && (
                                <div style={{ marginTop: 'var(--space-md)' }}>
                                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                                        Class schedule
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                        {viewSubject.schedule.map((slot, idx) => (
                                            <div key={idx} className="subject-view-slot" style={{ background: DAY_COLORS[slot.day] || '#F9FAFB' }}>
                        <span style={{ fontWeight: 600, color: DAY_TEXT[slot.day] || '#374151', minWidth: 90 }}>
                          {slot.day}
                        </span>
                                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                          {slot.startTime} – {slot.endTime}
                        </span>
                                                {slot.room && (
                                                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                            📍 {slot.room}
                          </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="modal__footer">
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => setViewSubject(null)}
                                >
                                    Close
                                </button>
                                {user?.role === 'admin' && (
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => { setViewSubject(null); openEdit(viewSubject); }}
                                    >
                                        Edit subject
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Subject card component ── */
function SubjectCard({ subject, canManage, DAY_COLORS, DAY_TEXT, onView, onEdit, onDelete, deleting }) {
    return (
        <div className="subject-card card">

            {/* Card top */}
            <div className="subject-card__top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    <span className="subject-card__code">{subject.code}</span>
                    <span
                        className="badge"
                        style={{
                            background: subject.isElective ? '#F5F3FF' : '#ECFDF5',
                            color: subject.isElective ? '#7C3AED' : '#059669',
                        }}
                    >
            {subject.isElective ? 'Elective' : 'Core'}
          </span>
                </div>
                <span className="subject-card__semester">
          Sem {subject.semester}
        </span>
            </div>

            {/* Name */}
            <h3 className="subject-card__name">{subject.name}</h3>

            {/* Course */}
            <p className="subject-card__course">
                📚 {subject.course?.title || '—'}
            </p>

            {/* Description */}
            {subject.description && (
                <p className="subject-card__desc">
                    {subject.description.slice(0, 80)}
                    {subject.description.length > 80 ? '…' : ''}
                </p>
            )}

            {/* Meta row */}
            <div className="subject-card__meta">
                <span>🎓 {subject.credits} credits</span>
                <span>👤 {subject.teacher?.name || 'Unassigned'}</span>
            </div>

            {/* Schedule pills */}
            {subject.schedule?.length > 0 && (
                <div className="subject-card__schedule">
                    {subject.schedule.map((slot, idx) => (
                        <span
                            key={idx}
                            className="subject-schedule-pill"
                            style={{
                                background: DAY_COLORS[slot.day] || '#F3F4F6',
                                color: DAY_TEXT[slot.day] || '#374151',
                            }}
                        >
              {slot.day.slice(0, 3)} {slot.startTime}
                            {slot.room ? ` · ${slot.room}` : ''}
            </span>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className="subject-card__actions">
                <button className="btn btn-ghost btn-sm" onClick={onView}>
                    👁 View
                </button>
                {canManage && (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={onEdit}>
                            Edit
                        </button>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={onDelete}
                            disabled={deleting}
                        >
                            {deleting ? '…' : 'Delete'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}