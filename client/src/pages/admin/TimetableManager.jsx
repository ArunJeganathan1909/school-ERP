import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchTimetables,
    fetchTimetable,
    createTimetable,
    updateTimetable,
    updateSlot,
    deleteTimetable,
    clearTimetableError,
    clearCurrentTimetable,
} from '../../store/slices/timetableSlice';
import { fetchCourses } from '../../store/slices/courseSlice';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const emptyPeriod = () => ({ number: 1, startTime: '08:00', endTime: '08:40', label: '', isBreak: false });

export default function TimetableManager() {
    const dispatch = useDispatch();
    const { list, current, loading, error } = useSelector((s) => s.timetables);
    const { list: courses } = useSelector((s) => s.courses);
    const [subjects, setSubjects] = useState([]);

    const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Create form state
    const [form, setForm] = useState({
        course: '',
        term: '',
        workingDays: DEFAULT_DAYS,
        periods: [emptyPeriod()],
    });

    // Slot editor modal state
    const [slotModal, setSlotModal] = useState(null); // { day, period, currentSubject }

    useEffect(() => {
        dispatch(fetchTimetables());
        dispatch(fetchCourses());
        api.get('/subjects?limit=1000')
            .then(({ data }) => setSubjects(data.subjects || []))
            .catch(() => setSubjects([]));
    }, [dispatch]);

    // ── helpers ──
    const courseLabel = (courseField) => {
        if (!courseField) return '—';
        if (typeof courseField === 'object') return `${courseField.title} (${courseField.code})`;
        const c = courses.find((c) => c._id === courseField);
        return c ? `${c.title} (${c.code})` : '—';
    };

    const subjectsForCourse = (courseId) =>
        subjects.filter((s) => String(s.course?._id || s.course) === String(courseId));

    // ── create form handlers ──
    const handlePeriodChange = (idx, field, value) => {
        setForm((f) => {
            const periods = [...f.periods];
            periods[idx] = { ...periods[idx], [field]: field === 'isBreak' ? value : value };
            return { ...f, periods };
        });
    };

    const addPeriod = () => {
        setForm((f) => ({
            ...f,
            periods: [...f.periods, { ...emptyPeriod(), number: f.periods.length + 1 }],
        }));
    };

    const removePeriod = (idx) => {
        setForm((f) => ({ ...f, periods: f.periods.filter((_, i) => i !== idx) }));
    };

    const toggleDay = (day) => {
        setForm((f) => {
            const has = f.workingDays.includes(day);
            return {
                ...f,
                workingDays: has ? f.workingDays.filter((d) => d !== day) : [...f.workingDays, day],
            };
        });
    };

    const resetForm = () => {
        setForm({ course: '', term: '', workingDays: DEFAULT_DAYS, periods: [emptyPeriod()] });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        dispatch(clearTimetableError());

        const periods = form.periods.map((p, i) => ({
            ...p,
            number: i + 1,
            startTime: p.startTime,
            endTime: p.endTime,
        }));

        const result = await dispatch(
            createTimetable({
                course: form.course,
                term: form.term,
                workingDays: form.workingDays,
                periods,
            })
        );

        if (!result.error) {
            resetForm();
            setView('edit');
        }
    };

    // ── edit / grid view ──
    const openEditor = async (id) => {
        dispatch(clearTimetableError());
        await dispatch(fetchTimetable(id));
        setView('edit');
    };

    const backToList = () => {
        dispatch(clearCurrentTimetable());
        dispatch(clearTimetableError());
        setView('list');
    };

    const handleToggleActive = (timetable) => {
        dispatch(updateTimetable({ id: timetable._id, data: { isActive: !timetable.isActive } }));
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        await dispatch(deleteTimetable(deleteTarget._id));
        setDeleteTarget(null);
        if (current?._id === deleteTarget._id) backToList();
    };

    // ── slot grid helpers ──
    const getSlot = (day, periodNumber) =>
        current?.slots?.find((s) => s.day === day && s.period === periodNumber);

    const openSlotModal = (day, period) => {
        if (period.isBreak) return;
        const slot = getSlot(day, period.number);
        setSlotModal({
            day,
            period: period.number,
            currentSubject: slot?.subject?._id || slot?.subject || '',
        });
    };

    const handleAssignSubject = async (subjectId) => {
        if (!slotModal || !current) return;
        await dispatch(
            updateSlot({
                id: current._id,
                day: slotModal.day,
                period: slotModal.period,
                subjectId: subjectId || null,
            })
        );
        setSlotModal(null);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // LIST VIEW
    // ─────────────────────────────────────────────────────────────────────────
    if (view === 'list') {
        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <h1 className="topbar__title">Timetable management</h1>
                        <div className="topbar__right">
                            <NotificationBell />
                        </div>
                    </div>
                    <div className="page-body">
                        <div className="dashboard-welcome">
                            <div className="dashboard-welcome__text">
                                <h2>Timetable Manager</h2>
                                <p>Create and manage class timetables for each course and term.</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => setView('create')}>
                                + New Timetable
                            </button>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                        <div className="card">
                            {loading ? (
                                <p>Loading timetables…</p>
                            ) : list.length === 0 ? (
                                <p style={{ color: 'var(--color-text-secondary)' }}>No timetables created yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    {list.map((tt) => (
                                        <div
                                            key={tt._id}
                                            className="quick-link-btn"
                                            style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
                                        >
                                            <div className="quick-link-btn__icon" style={{ background: 'var(--color-primary-light)' }}>🗓</div>
                                            <div className="quick-link-btn__label">
                                                <div style={{ fontWeight: 600 }}>{courseLabel(tt.course)}</div>
                                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                                    {tt.term} · {tt.workingDays.length} days · {tt.periods.length} periods
                                                </div>
                                            </div>
                                            <span className={`badge ${tt.isActive ? 'badge-success' : 'badge-error'}`}>
                                        {tt.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                            <button className="btn btn-outline btn-sm" onClick={() => handleToggleActive(tt)}>
                                                {tt.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEditor(tt._id)}>
                                                Edit
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(tt)}>
                                                Delete
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Delete confirmation modal */}
                        {deleteTarget && (
                            <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                                    <div className="modal__header">
                                        <div className="modal__title">Delete timetable?</div>
                                    </div>
                                    <div className="modal__body">
                                        <p>
                                            This will permanently delete the timetable for{' '}
                                            <strong>{courseLabel(deleteTarget.course)}</strong> ({deleteTarget.term}).
                                            This action cannot be undone.
                                        </p>
                                    </div>
                                    <div className="modal__footer">
                                        <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                                        <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE VIEW
    // ─────────────────────────────────────────────────────────────────────────
    if (view === 'create') {
        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <h1 className="topbar__title">Timetable management</h1>
                        <div className="topbar__right">
                            <NotificationBell />
                        </div>
                    </div>
                    <div className="page-body">
                        <div className="dashboard-welcome">
                            <div className="dashboard-welcome__text">
                                <h2>New Timetable</h2>
                                <p>Define the course, term, working days, and period structure.</p>
                            </div>
                            <button className="btn btn-ghost" onClick={() => { resetForm(); setView('list'); }}>
                                ← Back to list
                            </button>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                        <form className="card" onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Course</label>
                                    <select
                                        className="form-input"
                                        value={form.course}
                                        onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
                                        required
                                    >
                                        <option value="">Select a course…</option>
                                        {courses.map((c) => (
                                            <option key={c._id} value={c._id}>{c.title} ({c.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Term</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. 2025-2026 Semester 1"
                                        value={form.term}
                                        onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Working Days</label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                    {ALL_DAYS.map((day) => (
                                        <button
                                            type="button"
                                            key={day}
                                            onClick={() => toggleDay(day)}
                                            className={`badge ${form.workingDays.includes(day) ? 'badge-success' : ''}`}
                                            style={{
                                                cursor: 'pointer',
                                                border: '1px solid var(--color-border)',
                                                background: form.workingDays.includes(day) ? undefined : 'var(--color-bg)',
                                                color: form.workingDays.includes(day) ? undefined : 'var(--color-text-secondary)',
                                            }}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <div className="card-header" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Periods</label>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={addPeriod}>+ Add Period</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                                    {form.periods.map((p, idx) => (
                                        <div key={idx} className="form-row" style={{ gridTemplateColumns: '60px 1fr 1fr 1.5fr auto auto', alignItems: 'end', gap: 'var(--space-sm)' }}>
                                            <div className="form-group">
                                                <label className="form-label">#</label>
                                                <input className="form-input" value={idx + 1} disabled />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Start</label>
                                                <input
                                                    type="time"
                                                    className="form-input"
                                                    value={p.startTime}
                                                    onChange={(e) => handlePeriodChange(idx, 'startTime', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">End</label>
                                                <input
                                                    type="time"
                                                    className="form-input"
                                                    value={p.endTime}
                                                    onChange={(e) => handlePeriodChange(idx, 'endTime', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Label (optional)</label>
                                                <input
                                                    className="form-input"
                                                    placeholder="e.g. Lunch Break"
                                                    value={p.label}
                                                    onChange={(e) => handlePeriodChange(idx, 'label', e.target.value)}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Break?</label>
                                                <input
                                                    type="checkbox"
                                                    checked={p.isBreak}
                                                    onChange={(e) => handlePeriodChange(idx, 'isBreak', e.target.checked)}
                                                    style={{ width: 20, height: 20 }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">&nbsp;</label>
                                                <button
                                                    type="button"
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => removePeriod(idx)}
                                                    disabled={form.periods.length === 1}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="modal__footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { resetForm(); setView('list'); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? <span className="spinner" /> : 'Create Timetable'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EDIT / GRID VIEW
    // ─────────────────────────────────────────────────────────────────────────
    if (view === 'edit') {
        if (loading && !current) {
            return (
                <div className="app-shell">
                    <Sidebar />
                    <div className="main-content">
                        <div className="topbar">
                            <h1 className="topbar__title">Timetable management</h1>
                            <div className="topbar__right"><NotificationBell /></div>
                        </div>
                        <div className="page-body"><p>Loading timetable…</p></div>
                    </div>
                </div>
            );
        }
        if (!current) {
            return (
                <div className="app-shell">
                    <Sidebar />
                    <div className="main-content">
                        <div className="topbar">
                            <h1 className="topbar__title">Timetable management</h1>
                            <div className="topbar__right"><NotificationBell /></div>
                        </div>
                        <div className="page-body">
                            <p>Timetable not found.</p>
                            <button className="btn btn-ghost" onClick={backToList}>← Back to list</button>
                        </div>
                    </div>
                </div>
            );
        }

        const courseSubjects = subjectsForCourse(current.course?._id || current.course);

        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <h1 className="topbar__title">Timetable management</h1>
                        <div className="topbar__right">
                            <NotificationBell />
                        </div>
                    </div>
                    <div className="page-body">
                        <div className="dashboard-welcome">
                            <div className="dashboard-welcome__text">
                                <h2>{courseLabel(current.course)}</h2>
                                <p>{current.term} · {current.workingDays.length} days · {current.periods.length} periods</p>
                            </div>
                            <button className="btn btn-ghost" onClick={backToList}>← Back to list</button>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                        <div className="card" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                                <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                        Period
                                    </th>
                                    {current.workingDays.map((day) => (
                                        <th key={day} style={{ textAlign: 'left', padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                            {day}
                                        </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {[...current.periods].sort((a, b) => a.number - b.number).map((period) => (
                                    <tr key={period.number}>
                                        <td style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                                {period.isBreak ? (period.label || 'Break') : `Period ${period.number}`}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                {period.startTime} – {period.endTime}
                                            </div>
                                        </td>
                                        {current.workingDays.map((day) => {
                                            if (period.isBreak) {
                                                return (
                                                    <td key={day} style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                                                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                        {period.label || 'Break'}
                                                    </span>
                                                    </td>
                                                );
                                            }
                                            const slot = getSlot(day, period.number);
                                            const subject = slot?.subject;
                                            return (
                                                <td
                                                    key={day}
                                                    onClick={() => openSlotModal(day, period)}
                                                    style={{
                                                        padding: 'var(--space-sm)',
                                                        borderBottom: '1px solid var(--color-border)',
                                                        cursor: 'pointer',
                                                        transition: 'background var(--transition-fast)',
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-primary-light)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = ''}
                                                >
                                                    {subject ? (
                                                        <div>
                                                            <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{subject.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                                {subject.code}{subject.teacher?.name ? ` · ${subject.teacher.name}` : ''}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>+ Add subject</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Slot assignment modal */}
                        {slotModal && (
                            <div className="modal-overlay" onClick={() => setSlotModal(null)}>
                                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                                    <div className="modal__header">
                                        <div className="modal__title">{slotModal.day} · Period {slotModal.period}</div>
                                    </div>
                                    <div className="modal__body">
                                        <div className="form-group">
                                            <label className="form-label">Subject</label>
                                            <select
                                                className="form-input"
                                                value={slotModal.currentSubject}
                                                onChange={(e) => setSlotModal((m) => ({ ...m, currentSubject: e.target.value }))}
                                            >
                                                <option value="">— Free / unassigned —</option>
                                                {courseSubjects.map((s) => (
                                                    <option key={s._id} value={s._id}>
                                                        {s.name} ({s.code}){s.teacher?.name ? ` · ${s.teacher.name}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {courseSubjects.length === 0 && (
                                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                            No subjects found for this course.
                                        </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="modal__footer">
                                        <button className="btn btn-ghost" onClick={() => setSlotModal(null)}>Cancel</button>
                                        <button className="btn btn-primary" onClick={() => handleAssignSubject(slotModal.currentSubject)} disabled={loading}>
                                            {loading ? <span className="spinner" /> : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}