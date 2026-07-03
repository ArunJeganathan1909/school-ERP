import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchTimetables, fetchTimetable, createTimetable,
    updateTimetable, updateSlot, deleteTimetable,
    clearTimetableError, clearCurrentTimetable,
} from '../../store/slices/timetableSlice';
import { fetchAcademicYears } from '../../store/slices/academicYearSlice';
import { fetchGrades } from '../../store/slices/gradeSlice';
import { fetchSections } from '../../store/slices/sectionSlice';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import './TimetableManager.css';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const emptyPeriod = () => ({ number: 1, startTime: '07:30', endTime: '08:10', label: '', isBreak: false });

export default function TimetableManager() {
    const dispatch = useDispatch();
    const { list, current, loading, error } = useSelector((s) => s.timetables);
    const { list: years }    = useSelector((s) => s.academicYears);
    const { list: grades }   = useSelector((s) => s.grades);
    const { list: sections } = useSelector((s) => s.sections);

    const [subjects,      setSubjects]      = useState([]);
    const [view,          setView]          = useState('list'); // 'list' | 'create' | 'edit'
    const [deleteTarget,  setDeleteTarget]  = useState(null);

    // Filters for list view
    const [filterYear,    setFilterYear]    = useState('');
    const [filterGrade,   setFilterGrade]   = useState('');
    const [filterSection, setFilterSection] = useState('');

    // Create form
    const [form, setForm] = useState({
        academicYear: '',
        grade:        '',
        section:      '',
        semester:     1,
        term:         '',
        workingDays:  DEFAULT_DAYS,
        periods:      [emptyPeriod()],
    });

    const [slotModal, setSlotModal] = useState(null);

    useEffect(() => {
        dispatch(fetchAcademicYears());
        dispatch(fetchTimetables());
        api.get('/subjects?limit=1000')
            .then(({ data }) => setSubjects(data.subjects || []))
            .catch(() => {});
    }, [dispatch]);

    useEffect(() => {
        if (filterYear) {
            dispatch(fetchGrades({ academicYear: filterYear }));
            dispatch(fetchSections({ academicYear: filterYear }));
        }
    }, [dispatch, filterYear]);

    useEffect(() => {
        const params = {};
        if (filterYear)    params.academicYear = filterYear;
        if (filterSection) params.section      = filterSection;
        dispatch(fetchTimetables(params));
    }, [dispatch, filterYear, filterSection]);

    // When section changes in create form, auto-fill term
    useEffect(() => {
        if (form.section && form.semester) {
            const sec = sections.find((s) => s._id === form.section);
            const yr  = years.find((y) => y._id === form.academicYear);
            if (sec && yr) {
                const gradeNum = sec.grade?.gradeNumber || grades.find(g => g._id === sec.grade)?.gradeNumber || '';
                setForm((f) => ({
                    ...f,
                    term: `${yr.name} — Grade ${gradeNum}${sec.name} Semester ${f.semester}`,
                }));
            }
        }
    }, [form.section, form.semester, form.academicYear]);

    // ── helpers ──
    const sectionLabel = (s) => {
        if (!s) return '—';
        if (typeof s === 'object') {
            const g = s.grade?.gradeNumber || '';
            return `Grade ${g}${s.name}`;
        }
        const found = sections.find((x) => x._id === s);
        return found ? `Grade ${found.grade?.gradeNumber || ''}${found.name}` : '—';
    };

    const subjectsForSection = (sectionId) =>
        subjects.filter((s) => String(s.section?._id || s.section) === String(sectionId));

    // ── period helpers ──
    const handlePeriodChange = (idx, field, value) => {
        setForm((f) => {
            const periods = [...f.periods];
            periods[idx] = { ...periods[idx], [field]: value };
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
        setForm((f) => ({
            ...f,
            periods: f.periods.filter((_, i) => i !== idx).map((p, i) => ({ ...p, number: i + 1 })),
        }));
    };

    const toggleDay = (day) => {
        setForm((f) => {
            const has = f.workingDays.includes(day);
            return { ...f, workingDays: has ? f.workingDays.filter((d) => d !== day) : [...f.workingDays, day] };
        });
    };

    const resetForm = () => {
        setForm({ academicYear: '', grade: '', section: '', semester: 1, term: '', workingDays: DEFAULT_DAYS, periods: [emptyPeriod()] });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        dispatch(clearTimetableError());
        const result = await dispatch(createTimetable({
            section:      form.section,
            grade:        form.grade,
            academicYear: form.academicYear,
            semester:     Number(form.semester),
            term:         form.term,
            workingDays:  form.workingDays,
            periods:      form.periods.map((p, i) => ({ ...p, number: i + 1 })),
        }));
        if (!result.error) { resetForm(); setView('edit'); }
    };

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

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        await dispatch(deleteTimetable(deleteTarget._id));
        setDeleteTarget(null);
        if (current?._id === deleteTarget._id) backToList();
    };

    const getSlot = (day, periodNumber) =>
        current?.slots?.find((s) => s.day === day && s.period === periodNumber);

    const openSlotModal = (day, period) => {
        if (period.isBreak) return;
        const slot = getSlot(day, period.number);
        setSlotModal({ day, period: period.number, currentSubject: slot?.subject?._id || slot?.subject || '' });
    };

    const handleAssignSubject = async (subjectId) => {
        if (!slotModal || !current) return;
        await dispatch(updateSlot({ id: current._id, day: slotModal.day, period: slotModal.period, subjectId: subjectId || null }));
        setSlotModal(null);
    };

    const activeYear = years.find((y) => y.isActive);
    const filteredGrades   = filterYear ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === filterYear) : grades;
    const filteredSections = filterGrade ? sections.filter((s) => (s.grade?._id || s.grade) === filterGrade) : sections;

    // ── LIST VIEW ──
    if (view === 'list') {
        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <h1 className="topbar__title">Timetable management</h1>
                        <div className="topbar__right">
                            <NotificationBell />
                            <button className="btn btn-primary" onClick={() => setView('create')}>+ New timetable</button>
                        </div>
                    </div>
                    <div className="page-body">
                        {/* Filters */}
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                            <select className="form-input" style={{ width: 200 }} value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterGrade(''); setFilterSection(''); }}>
                                <option value="">All academic years</option>
                                {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                            </select>
                            <select className="form-input" style={{ width: 160 }} value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterSection(''); }} disabled={!filterYear}>
                                <option value="">All grades</option>
                                {filteredGrades.sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
                            </select>
                            <select className="form-input" style={{ width: 140 }} value={filterSection} onChange={(e) => setFilterSection(e.target.value)} disabled={!filterGrade}>
                                <option value="">All sections</option>
                                {filteredSections.map((s) => <option key={s._id} value={s._id}>{s.grade?.gradeNumber}{s.name}</option>)}
                            </select>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                        {loading && list.length === 0 ? (
                            <div className="empty-state"><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div>
                        ) : list.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">🗓</div>
                                <p>No timetables yet.</p>
                                <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => setView('create')}>Create first timetable</button>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                    <tr>
                                        <th>Section</th>
                                        <th>Term</th>
                                        <th>Semester</th>
                                        <th>Days</th>
                                        <th>Periods</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {list.map((tt) => (
                                        <tr key={tt._id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {tt.section
                                                    ? `Grade ${tt.grade?.gradeNumber || ''}${tt.section?.name}`
                                                    : tt.course?.title || '—'
                                                }
                                            </td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{tt.term}</td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>Semester {tt.semester}</td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>{tt.workingDays?.length}</td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>{tt.periods?.length}</td>
                                            <td>
                          <span className={`badge ${tt.isActive ? 'badge-success' : 'badge-error'}`}>
                            {tt.isActive ? 'Active' : 'Inactive'}
                          </span>
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
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Delete confirm */}
                {deleteTarget && (
                    <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                        <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal__header">
                                <h2 className="modal__title">Delete timetable</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>✕</button>
                            </div>
                            <div className="modal__body">
                                <p style={{ color: 'var(--color-text-secondary)' }}>
                                    Delete <strong>{deleteTarget.term}</strong>? All slot assignments will be lost.
                                </p>
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

    // ── CREATE VIEW ──
    if (view === 'create') {
        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setView('list')}>← Back</button>
                            <h1 className="topbar__title">Create timetable</h1>
                        </div>
                        <div className="topbar__right"><NotificationBell /></div>
                    </div>
                    <div className="page-body" style={{ maxWidth: 680 }}>
                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                        <form onSubmit={handleCreateSubmit}>
                            {/* Section selection */}
                            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                                <div className="card-header"><span className="card-title">Section</span></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Academic year *</label>
                                            <select className="form-input" value={form.academicYear} onChange={(e) => { setForm((f) => ({ ...f, academicYear: e.target.value, grade: '', section: '' })); dispatch(fetchGrades({ academicYear: e.target.value })); dispatch(fetchSections({ academicYear: e.target.value })); }} required>
                                                <option value="">Select academic year</option>
                                                {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Grade *</label>
                                            <select className="form-input" value={form.grade} onChange={(e) => { setForm((f) => ({ ...f, grade: e.target.value, section: '' })); }} disabled={!form.academicYear} required>
                                                <option value="">Select grade</option>
                                                {grades.filter((g) => (g.academicYear?._id || g.academicYear) === form.academicYear).sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                                    <option key={g._id} value={g._id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Section *</label>
                                            <select className="form-input" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} disabled={!form.grade} required>
                                                <option value="">Select section</option>
                                                {sections.filter((s) => (s.grade?._id || s.grade) === form.grade).map((s) => (
                                                    <option key={s._id} value={s._id}>
                                                        Grade {s.grade?.gradeNumber}{s.name}
                                                        {s.classTeacher?.name ? ` — ${s.classTeacher.name}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Semester *</label>
                                            <select className="form-input" value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: Number(e.target.value) }))}>
                                                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Semester {n}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Term label *</label>
                                        <input className="form-input" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} required placeholder="e.g. 2024-2025 Grade 7A Semester 1" />
                                    </div>
                                </div>
                            </div>

                            {/* Working days */}
                            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                                <div className="card-header"><span className="card-title">Working days</span></div>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                    {ALL_DAYS.map((day) => (
                                        <button
                                            key={day}
                                            type="button"
                                            className={`course-status-tab ${form.workingDays.includes(day) ? 'active' : ''}`}
                                            onClick={() => toggleDay(day)}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Periods */}
                            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                                <div className="card-header">
                                    <span className="card-title">Periods</span>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={addPeriod}>+ Add period</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {form.periods.map((period, idx) => (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr auto', gap: 'var(--space-sm)', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                        {period.isBreak ? '☕' : `P${idx + 1}`}
                      </span>
                                            <input className="form-input" type="time" value={period.startTime} onChange={(e) => handlePeriodChange(idx, 'startTime', e.target.value)} />
                                            <input className="form-input" type="time" value={period.endTime}   onChange={(e) => handlePeriodChange(idx, 'endTime', e.target.value)} />
                                            <input className="form-input" value={period.label} onChange={(e) => handlePeriodChange(idx, 'label', e.target.value)} placeholder="Label (optional)" />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={period.isBreak} onChange={(e) => handlePeriodChange(idx, 'isBreak', e.target.checked)} />
                                                Break
                                            </label>
                                            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => removePeriod(idx)} disabled={form.periods.length === 1}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? <><span className="spinner" /> Creating…</> : 'Create timetable & fill slots →'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // ── EDIT / GRID VIEW ──
    if (view === 'edit') {
        if (loading && !current) return (
            <div className="app-shell"><Sidebar /><div className="main-content"><div className="topbar"><h1 className="topbar__title">Timetable management</h1><div className="topbar__right"><NotificationBell /></div></div><div className="page-body"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div></div></div>
        );
        if (!current) return (
            <div className="app-shell"><Sidebar /><div className="main-content"><div className="topbar"><h1 className="topbar__title">Timetable management</h1></div><div className="page-body"><p>Not found.</p><button className="btn btn-ghost" onClick={backToList}>← Back</button></div></div></div>
        );

        const sectionId = current.section?._id || current.section;
        const courseSubjects = sectionId ? subjectsForSection(sectionId) : [];

        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={backToList}>← Back</button>
                            <h1 className="topbar__title">
                                {current.section
                                    ? `Grade ${current.grade?.gradeNumber || ''}${current.section?.name} — ${current.term}`
                                    : current.term}
                            </h1>
                        </div>
                        <div className="topbar__right"><NotificationBell /></div>
                    </div>

                    <div className="page-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Semester {current.semester} · {current.workingDays?.length} days · {current.periods?.length} periods
              </span>
                            <span className={`badge ${current.isActive ? 'badge-success' : 'badge-error'}`}>
                {current.isActive ? 'Active' : 'Inactive'}
              </span>
                            {courseSubjects.length === 0 && (
                                <div className="alert alert-info" style={{ margin: 0, fontSize: '0.8125rem' }}>
                                    ℹ No subjects found for this section. Add subjects under Subjects management first.
                                </div>
                            )}
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                                <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: 'var(--space-sm) var(--space-md)', borderBottom: '2px solid var(--color-border)', fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', width: 100 }}>Period</th>
                                    {current.workingDays?.map((day) => (
                                        <th key={day} style={{ textAlign: 'center', padding: 'var(--space-sm)', borderBottom: '2px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg)', minWidth: 120 }}>
                                            {day}
                                        </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {[...(current.periods || [])].sort((a, b) => a.number - b.number).map((period) => (
                                    <tr key={period.number}>
                                        <td style={{ padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                                {period.isBreak ? (period.label || 'Break') : `P${period.number}`}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                {period.startTime}–{period.endTime}
                                            </div>
                                        </td>
                                        {current.workingDays?.map((day) => {
                                            if (period.isBreak) return (
                                                <td key={day} style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', borderLeft: '1px solid var(--color-border)', background: '#FAFAFA', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{period.label || 'Break'}</span>
                                                </td>
                                            );
                                            const slot    = getSlot(day, period.number);
                                            const subject = slot?.subject;
                                            return (
                                                <td
                                                    key={day}
                                                    onClick={() => openSlotModal(day, period)}
                                                    style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', borderLeft: '1px solid var(--color-border)', cursor: 'pointer', verticalAlign: 'top', minHeight: 60 }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-primary-light)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = ''}
                                                >
                                                    {subject ? (
                                                        <>
                                                            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>{subject.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700 }}>{subject.code}</div>
                                                            {subject.teacher?.name && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{subject.teacher.name}</div>}
                                                        </>
                                                    ) : (
                                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>+ Assign</span>
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
                                <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                                    <div className="modal__header">
                                        <div className="modal__title">{slotModal.day} · Period {slotModal.period}</div>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setSlotModal(null)}>✕</button>
                                    </div>
                                    <div className="modal__body">
                                        <div className="form-group">
                                            <label className="form-label">Assign subject</label>
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
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                    No subjects found for this section. Add subjects first.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="modal__footer">
                                        <button className="btn btn-ghost" onClick={() => setSlotModal(null)}>Cancel</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleAssignSubject('')}>Clear slot</button>
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