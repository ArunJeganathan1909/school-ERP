import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchAcademicYears } from '../../store/slices/academicYearSlice';
import { fetchGrades, createGrade, updateGrade, deleteGrade, clearGradeError } from '../../store/slices/gradeSlice';
import './ManageGrades.css';

const STREAMS = ['none', 'general', 'science', 'arts', 'commerce', 'technology'];
const EMPTY = { academicYear: '', gradeNumber: 1, name: '', stream: 'none', description: '' };

export default function ManageGrades() {
    const dispatch = useDispatch();
    const { list: years }  = useSelector((s) => s.academicYears);
    const { list: grades, loading, error } = useSelector((s) => s.grades);

    const [filterYear, setFilterYear] = useState('');
    const [showModal,  setShowModal]  = useState(false);
    const [editGrade,  setEditGrade]  = useState(null);
    const [form,       setForm]       = useState(EMPTY);
    const [saving,     setSaving]     = useState(false);
    const [formError,  setFormError]  = useState('');

    useEffect(() => { dispatch(fetchAcademicYears()); }, [dispatch]);

    useEffect(() => {
        const params = {};
        if (filterYear) params.academicYear = filterYear;
        dispatch(fetchGrades(params));
    }, [dispatch, filterYear]);

    const openCreate = () => {
        setEditGrade(null);
        setForm({ ...EMPTY, academicYear: filterYear || '' });
        setFormError('');
        setShowModal(true);
    };

    const openEdit = (g) => {
        setEditGrade(g);
        setForm({
            academicYear: g.academicYear?._id || g.academicYear || '',
            gradeNumber:  g.gradeNumber,
            name:         g.name,
            stream:       g.stream || 'none',
            description:  g.description || '',
        });
        setFormError('');
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Auto-fill name when gradeNumber changes
        if (name === 'gradeNumber') {
            setForm((f) => ({ ...f, gradeNumber: Number(value), name: `Grade ${value}` }));
        } else {
            setForm((f) => ({ ...f, [name]: value }));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');
        dispatch(clearGradeError());
        const result = editGrade
            ? await dispatch(updateGrade({ id: editGrade._id, data: form }))
            : await dispatch(createGrade(form));
        setSaving(false);
        if (result.error) { setFormError(result.payload || 'Save failed'); return; }
        setShowModal(false);
    };

    const handleDelete = (g) => {
        if (!window.confirm(`Delete "${g.name}"? All sections under it will also be removed.`)) return;
        dispatch(deleteGrade(g._id));
    };

    const streamBadge = (s) => {
        const colors = {
            none: { bg: '#F9FAFB', color: '#6B7280' },
            general: { bg: '#EFF6FF', color: '#2563EB' },
            science: { bg: '#ECFDF5', color: '#059669' },
            arts: { bg: '#FEF3C7', color: '#92400E' },
            commerce: { bg: '#F5F3FF', color: '#7C3AED' },
            technology: { bg: '#FEF2F2', color: '#DC2626' },
        };
        const c = colors[s] || colors.none;
        return (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: c.bg, color: c.color, textTransform: 'capitalize' }}>
        {s === 'none' ? 'General' : s}
      </span>
        );
    };

    // Group by academic year for display
    const grouped = grades.reduce((acc, g) => {
        const key = g.academicYear?.name || 'Unknown year';
        if (!acc[key]) acc[key] = [];
        acc[key].push(g);
        return acc;
    }, {});

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Grades</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <button className="btn btn-primary" onClick={openCreate}>+ Add grade</button>
                    </div>
                </div>

                <div className="page-body">
                    {/* Year filter */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                        <select className="form-input" style={{ width: 220 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                            <option value="">All academic years</option>
                            {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>)}
                        </select>
                    </div>

                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                    {loading && grades.length === 0 ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                        </div>
                    ) : grades.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">🎓</div>
                            <p>No grades found. {years.length === 0 ? 'Create an academic year first.' : 'Add your first grade.'}</p>
                            {years.length > 0 && (
                                <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreate}>Add grade</button>
                            )}
                        </div>
                    ) : (
                        Object.entries(grouped).map(([yearName, gradeList]) => (
                            <div key={yearName} className="grade-year-group">
                                <div className="grade-year-label">{yearName}</div>
                                <div className="grade-cards-grid">
                                    {gradeList.sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                        <div key={g._id} className="grade-card card">
                                            <div className="grade-card__header">
                                                <div className="grade-card__number">{g.gradeNumber}</div>
                                                <div className="grade-card__actions">
                                                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(g)}>Edit</button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g)}>Del</button>
                                                </div>
                                            </div>
                                            <div className="grade-card__name">{g.name}</div>
                                            <div style={{ marginTop: 'var(--space-xs)' }}>{streamBadge(g.stream)}</div>
                                            {g.description && (
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>{g.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">{editGrade ? 'Edit grade' : 'Add grade'}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        {formError && <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>{formError}</div>}
                        <form className="modal__body" onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Academic year *</label>
                                <select className="form-input" name="academicYear" value={form.academicYear} onChange={handleChange} required>
                                    <option value="">Select academic year</option>
                                    {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Grade number *</label>
                                    <select className="form-input" name="gradeNumber" value={form.gradeNumber} onChange={handleChange} required>
                                        {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
                                            <option key={n} value={n}>Grade {n}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Display name *</label>
                                    <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Grade 7" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Stream</label>
                                <select className="form-input" name="stream" value={form.stream} onChange={handleChange}>
                                    {STREAMS.map((s) => (
                                        <option key={s} value={s} style={{ textTransform: 'capitalize' }}>
                                            {s === 'none' ? 'None / General' : s.charAt(0).toUpperCase() + s.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" name="description" value={form.description} onChange={handleChange} rows={2} style={{ resize: 'vertical' }} />
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner" /> Saving…</> : editGrade ? 'Update' : 'Create grade'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}