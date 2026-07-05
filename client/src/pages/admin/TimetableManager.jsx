import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import {
    fetchTimetables, fetchTimetable, createTimetable,
    updateTimetable, updateSlot, deleteTimetable,
    clearTimetableError, clearCurrentTimetable, clearLastSync,
} from '../../store/slices/timetableSlice';
import {
    fetchStructures, createStructure, updateStructure, deleteStructure,
} from '../../store/slices/timetableStructureSlice';
import { fetchAcademicYears } from '../../store/slices/academicYearSlice';
import { fetchGrades } from '../../store/slices/gradeSlice';
import { fetchSections } from '../../store/slices/sectionSlice';
import api from '../../api/axios';
import './TimetableManager.css';

const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const emptyPeriod = (num) => ({ number: num, startTime: '07:30', endTime: '08:10', label: '', isBreak: false });

export default function TimetableManager() {
    const dispatch = useDispatch();
    const { list, current, loading, error, lastSync } = useSelector((s) => s.timetables);
    const { list: structures } = useSelector((s) => s.timetableStructures);
    const { list: years }    = useSelector((s) => s.academicYears);
    const { list: grades }   = useSelector((s) => s.grades);
    const { list: sections } = useSelector((s) => s.sections);

    // Main view: 'structures' | 'list' | 'editor'
    const [view, setView] = useState('structures');

    // Filters
    const [filterYear,    setFilterYear]    = useState('');
    const [filterGrade,   setFilterGrade]   = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [filterSemester, setFilterSemester] = useState('');

    // Structure form
    const [showStructureModal, setShowStructureModal] = useState(false);
    const [editStructure, setEditStructure] = useState(null);
    const [structureForm, setStructureForm] = useState({
        academicYear: '', semester: 1, name: '',
        workingDays: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
        periods: [emptyPeriod(1)],
    });
    const [structureSaving, setStructureSaving] = useState(false);
    const [structureError,  setStructureError]  = useState('');

    // Timetable create form
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        structureRef: '', section: '', grade: '', academicYear: '', semester: 1, term: '',
    });
    const [createSaving, setCreateSaving] = useState(false);

    // Slot assignment
    const [slotModal,       setSlotModal]       = useState(null);
    const [freeSubjects,    setFreeSubjects]     = useState([]);
    const [busySubjects,    setBusySubjects]     = useState([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [conflictError,   setConflictError]   = useState('');
    const [slotSaving,      setSlotSaving]      = useState(false);
    const [applyToGrade,    setApplyToGrade]    = useState(true); // sync elective buckets across the grade's sections

    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        dispatch(fetchAcademicYears());
        dispatch(fetchStructures());
        dispatch(fetchTimetables());
    }, [dispatch]);

    useEffect(() => {
        if (filterYear) {
            dispatch(fetchGrades({ academicYear: filterYear }));
            dispatch(fetchSections({ academicYear: filterYear }));
            dispatch(fetchStructures({ academicYear: filterYear }));
        }
    }, [dispatch, filterYear]);

    useEffect(() => {
        if (filterGrade) dispatch(fetchSections({ grade: filterGrade, academicYear: filterYear }));
    }, [dispatch, filterGrade, filterYear]);

    useEffect(() => {
        const params = {};
        if (filterYear)     params.academicYear = filterYear;
        if (filterSection)  params.section      = filterSection;
        if (filterSemester) params.semester     = filterSemester;
        dispatch(fetchTimetables(params));
    }, [dispatch, filterYear, filterSection, filterSemester]);

    // ── Structure form helpers ────────────────────────────────────────────────

    const openCreateStructure = () => {
        setEditStructure(null);
        setStructureForm({ academicYear: filterYear || '', semester: 1, name: '', workingDays: ['Monday','Tuesday','Wednesday','Thursday','Friday'], periods: [emptyPeriod(1)] });
        setStructureError('');
        setShowStructureModal(true);
    };

    const openEditStructure = (s) => {
        setEditStructure(s);
        setStructureForm({
            academicYear: s.academicYear?._id || s.academicYear || '',
            semester:     s.semester,
            name:         s.name || '',
            workingDays:  [...s.workingDays],
            periods:      s.periods.map((p) => ({ ...p })),
        });
        setStructureError('');
        setShowStructureModal(true);
    };

    const toggleDay = (day) => {
        setStructureForm((f) => {
            const has = f.workingDays.includes(day);
            return { ...f, workingDays: has ? f.workingDays.filter((d) => d !== day) : [...f.workingDays, day] };
        });
    };

    const handlePeriodChange = (idx, field, value) => {
        setStructureForm((f) => {
            const periods = [...f.periods];
            periods[idx] = { ...periods[idx], [field]: field === 'isBreak' ? value : value };
            return { ...f, periods };
        });
    };

    const addPeriod = () => {
        setStructureForm((f) => ({
            ...f,
            periods: [...f.periods, emptyPeriod(f.periods.length + 1)],
        }));
    };

    const removePeriod = (idx) => {
        setStructureForm((f) => ({
            ...f,
            periods: f.periods.filter((_, i) => i !== idx).map((p, i) => ({ ...p, number: i + 1 })),
        }));
    };

    const handleSaveStructure = async (e) => {
        e.preventDefault();
        setStructureSaving(true);
        setStructureError('');
        const payload = {
            ...structureForm,
            periods: structureForm.periods.map((p, i) => ({ ...p, number: i + 1 })),
        };
        const result = editStructure
            ? await dispatch(updateStructure({ id: editStructure._id, data: payload }))
            : await dispatch(createStructure(payload));
        setStructureSaving(false);
        if (result.error) { setStructureError(result.payload || 'Save failed'); return; }
        setShowStructureModal(false);
    };

    const handleDeleteStructure = async (s) => {
        if (!window.confirm(`Delete structure "${s.name || s.academicYear?.name}"?`)) return;
        dispatch(deleteStructure(s._id));
    };

    // ── Timetable create helpers ──────────────────────────────────────────────

    const openCreateTimetable = () => {
        // Auto-fill from filters
        const structure = structures.find((s) => (s.academicYear?._id || s.academicYear) === filterYear);
        setCreateForm({
            structureRef: structure?._id || '',
            section:      filterSection || '',
            grade:        filterGrade   || '',
            academicYear: filterYear    || '',
            semester:     structure?.semester || 1,
            term:         '',
        });
        setShowCreateModal(true);
    };

    const handleCreateTimetable = async (e) => {
        e.preventDefault();
        setCreateSaving(true);
        dispatch(clearTimetableError());
        const result = await dispatch(createTimetable(createForm));
        setCreateSaving(false);
        if (!result.error) {
            setShowCreateModal(false);
            // Open the editor immediately
            await dispatch(fetchTimetable(result.payload._id));
            setView('editor');
        }
    };

    // ── Grid editor helpers ───────────────────────────────────────────────────

    const openEditor = async (id) => {
        dispatch(clearTimetableError());
        await dispatch(fetchTimetable(id));
        setView('editor');
    };

    const backToList = () => {
        dispatch(clearCurrentTimetable());
        dispatch(clearTimetableError());
        setConflictError('');
        setView('list');
    };

    const getSlot = (day, periodNumber) =>
        current?.slots?.find((s) => s.day === day && s.period === periodNumber);

    const openSlotModal = async (day, period) => {
        if (period.isBreak || !current) return;
        setConflictError('');
        dispatch(clearLastSync());
        const existingSlot = getSlot(day, period.number);
        setSlotModal({
            day,
            period: period.number,
            currentSubjectIds: existingSlot?.subjects?.map((s) => s._id) || [],
            currentBucket: existingSlot?.bucket || null,
        });
        setApplyToGrade(true);
        setSubjectsLoading(true);
        setFreeSubjects([]);
        setBusySubjects([]);
        try {
            const { data } = await api.get('/timetables/free-subjects', {
                params: {
                    sectionId:   current.section?._id || current.section,
                    day,
                    period:      period.number,
                    academicYear: current.academicYear?._id || current.academicYear,
                },
            });
            setFreeSubjects(data.subjects     || []);
            setBusySubjects(data.busySubjects || []);
        } catch { setFreeSubjects([]); setBusySubjects([]); }
        setSubjectsLoading(false);
    };

    const handleAssignSubject = async (subjectId) => {
        if (!current || !slotModal) return;
        setSlotSaving(true);
        setConflictError('');
        const result = await dispatch(updateSlot({
            id:       current._id,
            day:      slotModal.day,
            period:   slotModal.period,
            subjectId: subjectId || null,
            applyToGrade,
        }));
        setSlotSaving(false);
        if (result.error) {
            // 409 conflict — surface the teacher conflict message
            setConflictError(result.payload || 'Slot update failed');
            return;
        }
        setSlotModal(null);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        await dispatch(deleteTimetable(deleteTarget._id));
        setDeleteTarget(null);
        if (current?._id === deleteTarget._id) backToList();
    };

    const filteredGrades   = filterYear  ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === filterYear) : grades;
    const filteredSections = filterGrade ? sections.filter((s) => (s.grade?._id || s.grade) === filterGrade) : sections;
    const yearStructures   = filterYear  ? structures.filter((s) => (s.academicYear?._id || s.academicYear) === filterYear) : structures;

    const activeYear = years.find((y) => y.isActive);

    // ── STRUCTURES VIEW ───────────────────────────────────────────────────────

    if (view === 'structures') {
        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                            <h1 className="topbar__title">Timetable management</h1>
                        </div>
                        <div className="topbar__right">
                            <NotificationBell />
                            <button className="btn btn-outline" onClick={() => setView('list')}>View timetables →</button>
                            <button className="btn btn-primary" onClick={openCreateStructure}>+ New structure</button>
                        </div>
                    </div>

                    <div className="page-body">
                        <div className="tt-intro-banner">
                            <div className="tt-intro-banner__step active"><span>1</span><p>Create structure</p></div>
                            <div className="tt-intro-banner__arrow">→</div>
                            <div className="tt-intro-banner__step"><span>2</span><p>Create section timetables</p></div>
                            <div className="tt-intro-banner__arrow">→</div>
                            <div className="tt-intro-banner__step"><span>3</span><p>Fill subject grid</p></div>
                        </div>

                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', fontSize: '0.9375rem' }}>
                            First, define the shared period structure for each academic year. All section timetables inherit these working days and period times — you only define them once.
                        </p>

                        {/* Filter */}
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                            <select className="form-input" style={{ width: 220 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                                <option value="">All academic years</option>
                                {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                            </select>
                        </div>

                        {yearStructures.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">📋</div>
                                <p>No timetable structures yet.{activeYear ? ` Create one for ${activeYear.name}.` : ''}</p>
                                <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreateStructure}>Create first structure</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                                {yearStructures.map((s) => (
                                    <div key={s._id} className="tt-structure-card card">
                                        <div className="tt-structure-card__header">
                                            <div>
                                                <div className="tt-structure-card__name">
                                                    {s.name || `${s.academicYear?.name} — Semester ${s.semester}`}
                                                </div>
                                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                    {s.academicYear?.name} · Semester {s.semester} · {s.workingDays.length} days · {s.periods.length} periods
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                                <button className="btn btn-outline btn-sm" onClick={() => openEditStructure(s)}>Edit</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStructure(s)}>Del</button>
                                            </div>
                                        </div>

                                        {/* Working days chips */}
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
                                            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((short, i) => {
                                                const full = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i];
                                                return (
                                                    <span key={full} style={{
                                                        padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.8125rem', fontWeight: 600,
                                                        background: s.workingDays.includes(full) ? 'var(--color-primary)' : 'var(--color-border)',
                                                        color: s.workingDays.includes(full) ? '#fff' : 'var(--color-text-muted)',
                                                    }}>{short}</span>
                                                );
                                            })}
                                        </div>

                                        {/* Periods preview */}
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                            {s.periods.map((p) => (
                                                <div key={p.number} style={{
                                                    padding: '4px 10px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600,
                                                    background: p.isBreak ? '#FEF3C7' : 'var(--color-primary-light)',
                                                    color: p.isBreak ? '#92400E' : 'var(--color-primary)',
                                                    border: `1px solid ${p.isBreak ? '#FDE68A' : 'rgba(79,70,229,0.2)'}`,
                                                }}>
                                                    {p.isBreak ? `☕ ${p.label || 'Break'}` : `P${p.number}`} {p.startTime}–{p.endTime}
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => { setView('list'); setFilterYear(s.academicYear?._id || s.academicYear || ''); }}>
                                                Build section timetables →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Structure modal */}
                {showStructureModal && (
                    <div className="modal-overlay" onClick={() => setShowStructureModal(false)}>
                        <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal__header">
                                <h2 className="modal__title">{editStructure ? 'Edit structure' : 'New timetable structure'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowStructureModal(false)}>✕</button>
                            </div>
                            {structureError && <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>{structureError}</div>}
                            <form className="modal__body" onSubmit={handleSaveStructure}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Academic year *</label>
                                        <select className="form-input" value={structureForm.academicYear} onChange={(e) => setStructureForm((f) => ({ ...f, academicYear: e.target.value }))} required>
                                            <option value="">Select year</option>
                                            {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Semester *</label>
                                        <select className="form-input" value={structureForm.semester} onChange={(e) => setStructureForm((f) => ({ ...f, semester: Number(e.target.value) }))}>
                                            {[1,2,3,4].map((n) => <option key={n} value={n}>Semester {n}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Structure name</label>
                                    <input className="form-input" value={structureForm.name} onChange={(e) => setStructureForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. 2024-2025 Main Structure" />
                                </div>

                                {/* Working days */}
                                <div className="form-group">
                                    <label className="form-label">Working days</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                        {ALL_DAYS.map((day) => (
                                            <button key={day} type="button" className={`course-status-tab ${structureForm.workingDays.includes(day) ? 'active' : ''}`} onClick={() => toggleDay(day)}>
                                                {day.slice(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Periods */}
                                <div className="form-group">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                                        <label className="form-label" style={{ margin: 0 }}>Periods</label>
                                        <button type="button" className="btn btn-outline btn-sm" onClick={addPeriod}>+ Add period</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                        {structureForm.periods.map((period, idx) => (
                                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 100px auto', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: period.isBreak ? '#92400E' : 'var(--color-primary)', textAlign: 'center' }}>
                          {period.isBreak ? '☕' : `P${idx + 1}`}
                        </span>
                                                <input className="form-input" type="time" value={period.startTime} onChange={(e) => handlePeriodChange(idx, 'startTime', e.target.value)} />
                                                <input className="form-input" type="time" value={period.endTime}   onChange={(e) => handlePeriodChange(idx, 'endTime', e.target.value)} />
                                                <input className="form-input" value={period.label} onChange={(e) => handlePeriodChange(idx, 'label', e.target.value)} placeholder="Label (opt.)" />
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                    <input type="checkbox" checked={period.isBreak} onChange={(e) => handlePeriodChange(idx, 'isBreak', e.target.checked)} />
                                                    Break
                                                </label>
                                                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => removePeriod(idx)} disabled={structureForm.periods.length === 1}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="modal__footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowStructureModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={structureSaving}>
                                        {structureSaving ? <><span className="spinner" /> Saving…</> : editStructure ? 'Update' : 'Create structure'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── LIST VIEW ─────────────────────────────────────────────────────────────

    if (view === 'list') {
        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setView('structures')}>← Structures</button>
                            <h1 className="topbar__title">Section timetables</h1>
                        </div>
                        <div className="topbar__right">
                            <NotificationBell />
                            <button className="btn btn-primary" onClick={openCreateTimetable} disabled={yearStructures.length === 0}>
                                + New timetable
                            </button>
                        </div>
                    </div>

                    <div className="page-body">
                        {yearStructures.length === 0 && filterYear && (
                            <div className="alert alert-info" style={{ marginBottom: 'var(--space-lg)' }}>
                                No timetable structure found for this academic year. <button className="btn btn-ghost btn-sm" onClick={() => setView('structures')}>Create one first →</button>
                            </div>
                        )}

                        {/* Filters */}
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                            <select className="form-input" style={{ width: 200 }} value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterGrade(''); setFilterSection(''); }}>
                                <option value="">All academic years</option>
                                {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                            </select>
                            <select className="form-input" style={{ width: 200 }} value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterSection(''); }} disabled={!filterYear}>
                                <option value="">All grades</option>
                                {filteredGrades.sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => <option key={g._id} value={g._id}>{g.name}{g.stream !== 'none' ? ` (${g.stream})` : ''}</option>)}
                            </select>
                            <select className="form-input" style={{ width: 160 }} value={filterSection} onChange={(e) => setFilterSection(e.target.value)} disabled={!filterGrade}>
                                <option value="">All sections</option>
                                {filteredSections.map((s) => <option key={s._id} value={s._id}>Grade {s.grade?.gradeNumber}{s.name}</option>)}
                            </select>
                            <select className="form-input" style={{ width: 140 }} value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}>
                                <option value="">All semesters</option>
                                {[1,2,3,4].map((n) => <option key={n} value={n}>Semester {n}</option>)}
                            </select>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                        {loading && list.length === 0 ? (
                            <div className="empty-state"><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div>
                        ) : list.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">🗓</div>
                                <p>No section timetables yet.</p>
                                {yearStructures.length > 0 && <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreateTimetable}>Create first section timetable</button>}
                            </div>
                        ) : (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                    <tr>
                                        <th>Section</th>
                                        <th>Term</th>
                                        <th>Semester</th>
                                        <th>Structure</th>
                                        <th>Slots filled</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {list.map((tt) => {
                                        const filledSlots = tt.slots?.filter((s) => s.subjects?.length && !s.isBreak).length || 0;
                                        const totalSlots  = tt.slots?.filter((s) => !s.isBreak).length || 0;
                                        return (
                                            <tr key={tt._id}>
                                                <td style={{ fontWeight: 600 }}>
                                                    Grade {tt.grade?.gradeNumber}{tt.section?.name}
                                                    {tt.grade?.stream !== 'none' && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}> · {tt.grade?.stream}</span>}
                                                </td>
                                                <td style={{ color: 'var(--color-text-secondary)' }}>{tt.term}</td>
                                                <td style={{ color: 'var(--color-text-secondary)' }}>Semester {tt.semester}</td>
                                                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{tt.structureRef?.name || '—'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                        <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden', maxWidth: 80 }}>
                                                            <div style={{ height: '100%', width: totalSlots > 0 ? `${Math.round(filledSlots / totalSlots * 100)}%` : '0%', background: 'var(--color-primary)', borderRadius: 'var(--radius-full)' }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{filledSlots}/{totalSlots}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${tt.isActive ? 'badge-success' : 'badge-error'}`}>{tt.isActive ? 'Active' : 'Inactive'}</span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                                        <button className="btn btn-primary btn-sm" onClick={() => openEditor(tt._id)}>Edit grid</button>
                                                        <button className="btn btn-outline btn-sm" onClick={() => dispatch(updateTimetable({ id: tt._id, data: { isActive: !tt.isActive } }))}>
                                                            {tt.isActive ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(tt)}>Del</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Create timetable modal */}
                {showCreateModal && (
                    <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                        <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal__header">
                                <h2 className="modal__title">New section timetable</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>✕</button>
                            </div>
                            <form className="modal__body" onSubmit={handleCreateTimetable}>
                                <div className="form-group">
                                    <label className="form-label">Academic year *</label>
                                    <select className="form-input" value={createForm.academicYear} onChange={(e) => setCreateForm((f) => ({ ...f, academicYear: e.target.value, structureRef: '' }))} required>
                                        <option value="">Select year</option>
                                        {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Timetable structure *</label>
                                    <select className="form-input" value={createForm.structureRef} onChange={(e) => {
                                        const s = structures.find((x) => x._id === e.target.value);
                                        setCreateForm((f) => ({ ...f, structureRef: e.target.value, semester: s?.semester || 1 }));
                                    }} required>
                                        <option value="">Select structure</option>
                                        {structures.filter((s) => !createForm.academicYear || (s.academicYear?._id || s.academicYear) === createForm.academicYear).map((s) => (
                                            <option key={s._id} value={s._id}>{s.name || `Semester ${s.semester}`} — {s.periods.length} periods, {s.workingDays.length} days</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Grade *</label>
                                        <select className="form-input" value={createForm.grade} onChange={(e) => { setCreateForm((f) => ({ ...f, grade: e.target.value, section: '' })); if (e.target.value) dispatch(fetchSections({ grade: e.target.value, academicYear: createForm.academicYear })); }} required>
                                            <option value="">Select grade</option>
                                            {grades.filter((g) => !createForm.academicYear || (g.academicYear?._id || g.academicYear) === createForm.academicYear).sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                                <option key={g._id} value={g._id}>{g.name}{g.stream !== 'none' ? ` (${g.stream})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Section *</label>
                                        <select className="form-input" value={createForm.section} onChange={(e) => setCreateForm((f) => ({ ...f, section: e.target.value }))} disabled={!createForm.grade} required>
                                            <option value="">Select section</option>
                                            {sections.filter((s) => (s.grade?._id || s.grade) === createForm.grade).map((s) => (
                                                <option key={s._id} value={s._id}>Grade {s.grade?.gradeNumber}{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Term label *</label>
                                    <input className="form-input" value={createForm.term} onChange={(e) => setCreateForm((f) => ({ ...f, term: e.target.value }))} required placeholder="e.g. Grade 9A — 2024-2025 Semester 1" />
                                </div>
                                <div className="modal__footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={createSaving}>
                                        {createSaving ? <><span className="spinner" /> Creating…</> : 'Create & open editor →'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete confirm */}
                {deleteTarget && (
                    <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                        <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal__header"><h2 className="modal__title">Delete timetable</h2><button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>✕</button></div>
                            <div className="modal__body">
                                <p style={{ color: 'var(--color-text-secondary)' }}>Delete <strong>{deleteTarget.term}</strong>? All slot assignments will be lost.</p>
                                <div className="modal__footer">
                                    <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                                    <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── GRID EDITOR ───────────────────────────────────────────────────────────

    if (view === 'editor') {
        if (loading && !current) return (
            <div className="app-shell"><Sidebar /><div className="main-content"><div className="page-body"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div></div></div>
        );

        if (!current) return (
            <div className="app-shell"><Sidebar /><div className="main-content"><div className="page-body"><p>Not found.</p><button className="btn btn-ghost" onClick={backToList}>← Back</button></div></div></div>
        );

        const filledSlots = current.slots?.filter((s) => s.subjects?.length && !s.isBreak).length || 0;
        const totalSlots  = current.slots?.filter((s) => !s.isBreak).length || 0;
        const pct = totalSlots > 0 ? Math.round(filledSlots / totalSlots * 100) : 0;

        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={backToList}>← Back</button>
                            <h1 className="topbar__title">
                                Grade {current.grade?.gradeNumber}{current.section?.name} — {current.term}
                            </h1>
                        </div>
                        <div className="topbar__right"><NotificationBell /></div>
                    </div>

                    <div className="page-body">
                        {/* Progress bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.8125rem' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Grid completion</span>
                                    <span style={{ fontWeight: 600 }}>{filledSlots}/{totalSlots} slots ({pct}%)</span>
                                </div>
                                <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#059669' : 'var(--color-primary)', transition: 'width 0.4s ease', borderRadius: 'var(--radius-full)' }} />
                                </div>
                            </div>
                            <span className={`badge ${current.isActive ? 'badge-success' : 'badge-error'}`}>{current.isActive ? 'Active' : 'Inactive'}</span>
                            {current.section?.room && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>🏠 {current.section.room}</span>}
                        </div>

                        <div className="alert alert-info" style={{ marginBottom: 'var(--space-lg)', fontSize: '0.8125rem' }}>
                            Click any cell to assign a subject. Only teachers who are <strong>free at that period</strong> will be shown as available. Busy teachers are shown greyed out as a reference.
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                            <table className="tt-grid">
                                <thead>
                                <tr>
                                    <th className="tt-grid__period-col">Period</th>
                                    {current.workingDays?.map((day) => (
                                        <th key={day} className="tt-grid__day-col">
                                            <div>{day.slice(0, 3)}</div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 400 }}>{day}</div>
                                        </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {[...(current.periods || [])].sort((a, b) => a.number - b.number).map((period) => (
                                    <tr key={period.number}>
                                        <td className="tt-grid__period-cell">
                                            <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                                                {period.isBreak ? (period.label || 'Break') : `P${period.number}`}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                                {period.startTime}–{period.endTime}
                                            </div>
                                        </td>
                                        {current.workingDays?.map((day) => {
                                            if (period.isBreak) {
                                                return (
                                                    <td key={day} className="tt-grid__break-cell">
                                                        {period.label || 'Break'}
                                                    </td>
                                                );
                                            }
                                            const slot     = getSlot(day, period.number);
                                            const subjects = slot?.subjects || [];
                                            return (
                                                <td
                                                    key={day}
                                                    className={`tt-grid__slot-cell ${subjects.length ? 'tt-grid__slot-cell--filled' : 'tt-grid__slot-cell--empty'}`}
                                                    onClick={() => openSlotModal(day, period)}
                                                >
                                                    {subjects.length ? (
                                                        <>
                                                            {subjects.map((subject) => (
                                                                <div key={subject._id} style={{ marginBottom: 2 }}>
                                                                    <div className="tt-slot-name">{subject.name}</div>
                                                                    <div className="tt-slot-code">{subject.code}</div>
                                                                </div>
                                                            ))}
                                                            {slot.bucket && (
                                                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                                                                    🪣 {slot.bucket}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="tt-slot-free">+ Assign</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Slot assignment modal */}
                {slotModal && (
                    <div className="modal-overlay" onClick={() => { setSlotModal(null); setConflictError(''); dispatch(clearLastSync()); }}>
                        <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal__header">
                                <div className="modal__title">{slotModal.day} · Period {slotModal.period}</div>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setSlotModal(null); setConflictError(''); dispatch(clearLastSync()); }}>✕</button>
                            </div>
                            <div className="modal__body">
                                {conflictError && (
                                    <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                                        ⚠ {conflictError}
                                    </div>
                                )}

                                {lastSync && (lastSync.applied?.length > 0 || lastSync.skipped?.length > 0) && (
                                    <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)', fontSize: '0.8125rem' }}>
                                        {lastSync.applied?.length > 0 && (
                                            <div>✓ Synced to: {lastSync.applied.join(', ')}</div>
                                        )}
                                        {lastSync.skipped?.length > 0 && (
                                            <div style={{ color: '#DC2626' }}>
                                                ⚠ Skipped: {lastSync.skipped.map((s) => `${s.section} (${s.reason})`).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {subjectsLoading ? (
                                    <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                        <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                        <p>Checking teacher availability…</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Free subjects */}
                                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                                            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#059669', marginBottom: 'var(--space-sm)' }}>
                                                ✓ Available ({freeSubjects.length})
                                            </p>
                                            {freeSubjects.length === 0 ? (
                                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                                    No subjects with free teachers at this slot. Assign teachers to subjects first in Subject Teacher Assignments.
                                                </p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                                    {freeSubjects.map((s) => {
                                                        const isCurrent = slotModal.currentSubjectIds?.includes(s._id);
                                                        return (
                                                            <button
                                                                key={s._id}
                                                                className={`tt-subject-option ${isCurrent ? 'tt-subject-option--current' : ''}`}
                                                                onClick={() => handleAssignSubject(s._id)}
                                                                disabled={slotSaving}
                                                            >
                                                                <div>
                                                                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                                                                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginLeft: 8, fontSize: '0.8125rem' }}>{s.code}</span>
                                                                    {isCurrent && <span style={{ color: '#059669', marginLeft: 8, fontSize: '0.8125rem' }}>← Current</span>}
                                                                </div>
                                                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                                                    👨‍🏫 {s.teacher?.name || 'No teacher'}
                                                                    {s.bucket && <span style={{ marginLeft: 8, color: 'var(--color-text-muted)' }}>🪣 {s.bucket} — picking this fills the slot with every {s.bucket} option</span>}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Busy subjects — shown for reference */}
                                        {busySubjects.length > 0 && (
                                            <div>
                                                <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#DC2626', marginBottom: 'var(--space-sm)' }}>
                                                    ✕ Teacher busy at this slot ({busySubjects.length})
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                                    {busySubjects.map((s) => (
                                                        <div key={s._id} className="tt-subject-option tt-subject-option--busy">
                                                            <div>
                                                                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{s.name}</span>
                                                                <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: '0.8125rem' }}>{s.code}</span>
                                                            </div>
                                                            <div style={{ fontSize: '0.8125rem', color: '#DC2626', marginTop: 2 }}>
                                                                👨‍🏫 {s.teacher?.name || '—'} — busy in another class
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-md)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                    <input
                                        type="checkbox"
                                        checked={applyToGrade}
                                        onChange={(e) => setApplyToGrade(e.target.checked)}
                                    />
                                    Sync elective buckets to this same period across every section in this grade
                                </label>

                                <div className="modal__footer">
                                    <button className="btn btn-ghost" onClick={() => { setSlotModal(null); setConflictError(''); dispatch(clearLastSync()); }}>Cancel</button>
                                    {slotModal.currentSubjectIds?.length > 0 && (
                                        <button className="btn btn-danger" onClick={() => handleAssignSubject(null)} disabled={slotSaving}>
                                            {slotSaving ? <span className="spinner" /> : 'Clear slot'}
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

    return null;
}