import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import {
    fetchAcademicYears, createAcademicYear, updateAcademicYear,
    activateAcademicYear, setSemester, deleteAcademicYear, clearAYError,
} from '../../store/slices/academicYearSlice';
import './ManageAcademicYears.css';

const EMPTY = {
    name: '', startDate: '', endDate: '',
    totalSemesters: 3, currentSemester: 1, description: '',
};

export default function ManageAcademicYears() {
    const dispatch = useDispatch();
    const { list: years, loading, error } = useSelector((s) => s.academicYears);

    const [showModal,   setShowModal]   = useState(false);
    const [editYear,    setEditYear]    = useState(null);
    const [form,        setForm]        = useState(EMPTY);
    const [saving,      setSaving]      = useState(false);
    const [formError,   setFormError]   = useState('');
    const [semModal,    setSemModal]    = useState(null); // year object
    const [newSemester, setNewSemester] = useState(1);

    useEffect(() => { dispatch(fetchAcademicYears()); }, [dispatch]);

    const openCreate = () => { setEditYear(null); setForm(EMPTY); setFormError(''); setShowModal(true); };
    const openEdit   = (y) => {
        setEditYear(y);
        setForm({
            name:            y.name,
            startDate:       y.startDate?.slice(0, 10) || '',
            endDate:         y.endDate?.slice(0, 10)   || '',
            totalSemesters:  y.totalSemesters,
            currentSemester: y.currentSemester,
            description:     y.description || '',
        });
        setFormError('');
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');
        dispatch(clearAYError());
        let result;
        if (editYear) {
            result = await dispatch(updateAcademicYear({ id: editYear._id, data: form }));
        } else {
            result = await dispatch(createAcademicYear(form));
        }
        setSaving(false);
        if (result.error) { setFormError(result.payload || 'Save failed'); return; }
        setShowModal(false);
    };

    const handleActivate = async (y) => {
        if (!window.confirm(`Activate "${y.name}" as the current academic year? All others will be deactivated.`)) return;
        dispatch(activateAcademicYear(y._id));
    };

    const handleDelete = async (y) => {
        if (!window.confirm(`Delete "${y.name}"? This cannot be undone.`)) return;
        dispatch(deleteAcademicYear(y._id));
    };

    const openSemModal = (y) => { setSemModal(y); setNewSemester(y.currentSemester); };

    const handleSetSemester = async () => {
        await dispatch(setSemester({ id: semModal._id, currentSemester: Number(newSemester) }));
        setSemModal(null);
    };

    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Academic years</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <button className="btn btn-primary" onClick={openCreate}>+ New year</button>
                    </div>
                </div>

                <div className="page-body">
                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                    {loading && years.length === 0 ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                        </div>
                    ) : years.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📅</div>
                            <p>No academic years yet.</p>
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreate}>
                                Create first academic year
                            </button>
                        </div>
                    ) : (
                        <div className="ay-grid">
                            {years.map((y) => (
                                <div key={y._id} className={`ay-card card ${y.isActive ? 'ay-card--active' : ''}`}>
                                    <div className="ay-card__header">
                                        <div>
                                            <div className="ay-card__name">{y.name}</div>
                                            {y.isActive && (
                                                <span className="badge badge-success" style={{ marginTop: 4 }}>Active</span>
                                            )}
                                        </div>
                                        <div className="ay-card__actions">
                                            {!y.isActive && (
                                                <button className="btn btn-primary btn-sm" onClick={() => handleActivate(y)}>
                                                    Activate
                                                </button>
                                            )}
                                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(y)}>Edit</button>
                                            {!y.isActive && (
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(y)}>Del</button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="ay-card__info">
                                        <div className="ay-card__info-item">
                                            <span className="ay-card__info-label">Duration</span>
                                            <span className="ay-card__info-val">{fmt(y.startDate)} – {fmt(y.endDate)}</span>
                                        </div>
                                        <div className="ay-card__info-item">
                                            <span className="ay-card__info-label">Total semesters</span>
                                            <span className="ay-card__info-val">{y.totalSemesters}</span>
                                        </div>
                                        <div className="ay-card__info-item">
                                            <span className="ay-card__info-label">Current semester</span>
                                            <span className="ay-card__info-val" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        Semester {y.currentSemester}
                      </span>
                                        </div>
                                    </div>

                                    {y.isActive && (
                                        <div className="ay-card__semester-bar">
                                            {Array.from({ length: y.totalSemesters }, (_, i) => i + 1).map((sem) => (
                                                <div
                                                    key={sem}
                                                    className={`ay-card__semester-dot ${sem === y.currentSemester ? 'active' : sem < y.currentSemester ? 'done' : ''}`}
                                                >
                                                    <span>S{sem}</span>
                                                </div>
                                            ))}
                                            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => openSemModal(y)}>
                                                Advance semester
                                            </button>
                                        </div>
                                    )}

                                    {y.description && (
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>
                                            {y.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create / Edit modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">{editYear ? 'Edit academic year' : 'New academic year'}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        {formError && (
                            <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>{formError}</div>
                        )}
                        <form className="modal__body" onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Year name *</label>
                                <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. 2024-2025" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Start date *</label>
                                    <input className="form-input" type="date" name="startDate" value={form.startDate} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End date *</label>
                                    <input className="form-input" type="date" name="endDate" value={form.endDate} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Total semesters</label>
                                    <select className="form-input" name="totalSemesters" value={form.totalSemesters} onChange={handleChange}>
                                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Starting semester</label>
                                    <select className="form-input" name="currentSemester" value={form.currentSemester} onChange={handleChange}>
                                        {[1, 2, 3, 4].filter(n => n <= form.totalSemesters).map((n) => (
                                            <option key={n} value={n}>Semester {n}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" name="description" value={form.description} onChange={handleChange} rows={2} placeholder="Optional notes…" style={{ resize: 'vertical' }} />
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner" /> Saving…</> : editYear ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Semester advance modal */}
            {semModal && (
                <div className="modal-overlay" onClick={() => setSemModal(null)}>
                    <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">Change semester — {semModal.name}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSemModal(null)}>✕</button>
                        </div>
                        <div className="modal__body">
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                                This will update all sections under this academic year to the selected semester.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Set current semester to</label>
                                <select className="form-input" value={newSemester} onChange={(e) => setNewSemester(e.target.value)}>
                                    {Array.from({ length: semModal.totalSemesters }, (_, i) => i + 1).map((n) => (
                                        <option key={n} value={n}>Semester {n}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal__footer">
                                <button className="btn btn-ghost" onClick={() => setSemModal(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSetSemester}>Update semester</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}