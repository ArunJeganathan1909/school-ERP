import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import api from '../../api/axios';
import {
    fetchAssignmentsBySubject, assignTeacherToSection, removeAssignment,
    clearAssignmentError,
} from '../../store/slices/subjectTeacherAssignmentSlice';
import './ManageSubjects.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const GRADE_RANGES = [
    { val: '1-5',   label: 'Grade 1–5 (Primary)' },
    { val: '6-9',   label: 'Grade 6–9 (Junior Secondary)' },
    { val: '10-11', label: 'Grade 10–11 (O/L)' },
    { val: '12-13', label: 'Grade 12–13 (A/L)' },
];

const EMPTY_FORM = {
    name: '', code: '',
    scopeMode: 'range',        // 'range' | 'specific'
    gradeRange: '', grade: '', academicYear: '',
    isMandatory: true, bucket: '',
    credits: 3, description: '', semester: 1, schedule: [],
};
const EMPTY_SCHEDULE = { day: 'Monday', startTime: '09:00', endTime: '10:30', room: '' };

export default function ManageSubjects() {
    const dispatch = useDispatch();
    const { user } = useSelector((s) => s.auth);
    const {
        bySubject: assignments,
        loading: assignmentsLoading,
        error: assignmentError,
    } = useSelector((s) => s.subjectTeacherAssignments);

    const [subjects,  setSubjects]  = useState([]);
    const [years,     setYears]     = useState([]);
    const [grades,    setGrades]    = useState([]);
    const [teachers,  setTeachers]  = useState([]);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState('');

    // ── Filters ──────────────────────────────────────────────────────────────────
    const [filterMode,  setFilterMode]  = useState('range');   // 'range' | 'specific'
    const [filterRange, setFilterRange] = useState('');
    const [filterYear,  setFilterYear]  = useState('');
    const [filterGrade, setFilterGrade] = useState('');
    const [filterType,  setFilterType]  = useState('');         // '' | 'mandatory' | 'bucket'
    const [search,      setSearch]      = useState('');

    // ── Create/edit modal ────────────────────────────────────────────────────────
    const [showModal,   setShowModal]   = useState(false);
    const [editSubject, setEditSubject] = useState(null);
    const [form,        setForm]        = useState(EMPTY_FORM);
    const [saving,      setSaving]      = useState(false);
    const [formError,   setFormError]   = useState('');
    const [deletingId,  setDeletingId]  = useState(null);
    const [viewSubject, setViewSubject] = useState(null);

    // ── Teacher assignment manager modal ────────────────────────────────────────
    const [assignmentModalSubject, setAssignmentModalSubject] = useState(null);
    const [assignmentSections,     setAssignmentSections]     = useState([]); // every section within the subject's scope
    const [newRowSection,          setNewRowSection]           = useState('');
    const [newRowTeacher,          setNewRowTeacher]           = useState('');
    const [savingRow,              setSavingRow]               = useState(false);
    const [sectionsLoading,        setSectionsLoading]         = useState(false);

    useEffect(() => {
        fetchYears();
        fetchTeachers();
    }, []);

    useEffect(() => { if (filterYear) fetchGrades(filterYear, setGrades); }, [filterYear]);
    useEffect(() => { fetchSubjects(); }, [filterMode, filterRange, filterYear, filterGrade, filterType]);

    // Grades for the create/edit form (specific mode only)
    useEffect(() => { if (form.academicYear) fetchGrades(form.academicYear, setGrades); }, [form.academicYear]);

    // ── Fetchers ─────────────────────────────────────────────────────────────────

    const fetchSubjects = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (filterMode === 'range' && filterRange) {
                params.append('gradeRange', filterRange);
            }
            if (filterMode === 'specific') {
                if (filterGrade) params.append('grade', filterGrade);
                if (filterYear)  params.append('academicYear', filterYear);
            }
            if (filterType) params.append('isMandatory', filterType === 'mandatory' ? 'true' : 'false');

            const { data } = await api.get(`/subjects?${params}`);
            setSubjects(data.subjects || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load subjects');
        }
        setLoading(false);
    };

    const fetchYears    = async () => { try { const { data } = await api.get('/academic-years'); setYears(data.years || []); } catch { setYears([]); } };
    const fetchTeachers = async () => { try { const { data } = await api.get('/users?role=teacher&limit=100'); setTeachers(data.users || []); } catch { setTeachers([]); } };

    const fetchGrades = async (yearId, setter) => {
        try { const { data } = await api.get(`/grades?academicYear=${yearId}`); setter(data.grades || []); }
        catch { setter([]); }
    };

    // Sections belonging to one specific Grade document (A/L mode)
    const fetchSectionsForGrade = async (gradeId, setter) => {
        try { const { data } = await api.get(`/sections?grade=${gradeId}`); setter(data.sections || []); }
        catch { setter([]); }
    };

    // Sections across ALL academic years/grades whose gradeNumber falls inside a range
    // (used for range-mode subjects when picking which sections to assign teachers to)
    const fetchSectionsForRange = async (range, setter) => {
        setSectionsLoading(true);
        try {
            const [lo, hi] = range.split('-').map(Number);
            const { data: yearData } = await api.get('/academic-years');
            const yearIds = (yearData.years || []).map((y) => y._id);

            let allSections = [];
            for (const yId of yearIds) {
                const { data: gradeData } = await api.get(`/grades?academicYear=${yId}`);
                const matchingGrades = (gradeData.grades || []).filter((g) => g.gradeNumber >= lo && g.gradeNumber <= hi);
                for (const g of matchingGrades) {
                    const { data: secData } = await api.get(`/sections?grade=${g._id}`);
                    allSections = allSections.concat(secData.sections || []);
                }
            }
            setter(allSections);
        } catch {
            setter([]);
        }
        setSectionsLoading(false);
    };

    // ── Modal open helpers ───────────────────────────────────────────────────────

    const openCreate = () => {
        setEditSubject(null);
        setForm({
            ...EMPTY_FORM,
            scopeMode:    filterMode,
            gradeRange:   filterMode === 'range' ? filterRange : '',
            academicYear: filterMode === 'specific' ? filterYear  : '',
            grade:        filterMode === 'specific' ? filterGrade : '',
        });
        setFormError('');
        setShowModal(true);
    };

    const openEdit = (subject) => {
        setEditSubject(subject);
        setForm({
            name:         subject.name || '',
            code:         subject.code || '',
            scopeMode:    subject.gradeRange ? 'range' : 'specific',
            gradeRange:   subject.gradeRange || '',
            grade:        subject.grade?._id || subject.grade || '',
            academicYear: subject.academicYear?._id || subject.academicYear || '',
            isMandatory:  subject.isMandatory,
            bucket:       subject.bucket || '',
            credits:      subject.credits ?? 3,
            description:  subject.description || '',
            semester:     subject.semester ?? 1,
            schedule:     subject.schedule || [],
        });
        setFormError('');
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const addScheduleSlot    = () => setForm((f) => ({ ...f, schedule: [...f.schedule, { ...EMPTY_SCHEDULE }] }));
    const removeScheduleSlot = (idx) => setForm((f) => ({ ...f, schedule: f.schedule.filter((_, i) => i !== idx) }));
    const updateScheduleSlot = (idx, field, value) => setForm((f) => {
        const updated = [...f.schedule];
        updated[idx] = { ...updated[idx], [field]: value };
        return { ...f, schedule: updated };
    });

    // ── Save / Delete ────────────────────────────────────────────────────────────

    const handleSave = async (e) => {
        e.preventDefault();
        setFormError('');

        if (form.scopeMode === 'range' && !form.gradeRange) {
            setFormError('Select a grade range');
            return;
        }
        if (form.scopeMode === 'specific' && (!form.grade || !form.academicYear)) {
            setFormError('Select an academic year and a specific grade');
            return;
        }
        if (!form.isMandatory && !form.bucket.trim()) {
            setFormError('Bucket name is required for elective subjects (e.g. "scienceBucket", "ictBucket", "religion")');
            return;
        }

        setSaving(true);

        const payload = {
            name: form.name,
            code: form.code,
            scopeMode: form.scopeMode,
            gradeRange:   form.scopeMode === 'range'    ? form.gradeRange : null,
            grade:        form.scopeMode === 'specific' ? form.grade      : null,
            academicYear: form.scopeMode === 'specific' ? form.academicYear : null,
            isMandatory:  form.isMandatory,
            bucket:       form.isMandatory ? null : form.bucket.trim(),
            credits:      Number(form.credits),
            description:  form.description,
            semester:     Number(form.semester),
            schedule:     form.schedule,
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

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete subject "${name}"? Any teacher assignments for it will also be removed.`)) return;
        setDeletingId(id);
        try {
            await api.delete(`/subjects/${id}`);
            setSubjects((prev) => prev.filter((s) => s._id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
        setDeletingId(null);
    };

    // ── Teacher assignment manager ───────────────────────────────────────────────

    const openAssignmentManager = async (subject) => {
        setAssignmentModalSubject(subject);
        setNewRowSection('');
        setNewRowTeacher('');
        dispatch(clearAssignmentError());
        dispatch(fetchAssignmentsBySubject(subject._id));

        if (subject.gradeRange) {
            await fetchSectionsForRange(subject.gradeRange, setAssignmentSections);
        } else if (subject.grade) {
            await fetchSectionsForGrade(subject.grade?._id || subject.grade, setAssignmentSections);
        } else {
            setAssignmentSections([]);
        }
    };

    const handleAddRow = async () => {
        if (!newRowSection || !newRowTeacher || !assignmentModalSubject) return;
        setSavingRow(true);
        const result = await dispatch(assignTeacherToSection({
            subjectId: assignmentModalSubject._id,
            sectionId: newRowSection,
            teacherId: newRowTeacher,
        }));
        setSavingRow(false);
        if (!result.error) {
            setNewRowSection('');
            setNewRowTeacher('');
        }
    };

    const handleRemoveRow = (assignmentId) => {
        if (!window.confirm('Remove this teacher assignment?')) return;
        dispatch(removeAssignment(assignmentId));
    };

    // ── Derived data ─────────────────────────────────────────────────────────────

    const filtered = subjects.filter((s) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return s.name?.toLowerCase().includes(q)
            || s.code?.toLowerCase().includes(q)
            || s.bucket?.toLowerCase().includes(q);
    });

    const formGrades = form.academicYear
        ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === form.academicYear && g.gradeNumber >= 12)
        : [];

    const filteredGrades = filterYear
        ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === filterYear)
        : grades;

    const selectedFormGrade = formGrades.find((g) => g._id === form.grade);

    const mandatorySubjects = filtered.filter((s) => s.isMandatory);
    const bucketGroups = filtered.filter((s) => !s.isMandatory).reduce((acc, s) => {
        if (!acc[s.bucket]) acc[s.bucket] = [];
        acc[s.bucket].push(s);
        return acc;
    }, {});

    const assignedSectionIds = new Set(assignments.map((a) => a.section?._id));
    const unassignedSections = assignmentSections.filter((s) => !assignedSectionIds.has(s._id));

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Subject management</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        {user?.role === 'admin' && <button className="btn btn-primary" onClick={openCreate}>+ Add subject</button>}
                    </div>
                </div>

                <div className="page-body">

                    {/* ── Filter mode toggle ── */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                        {[
                            { val: 'range',    label: '📏 By grade range' },
                            { val: 'specific', label: '🎯 By specific grade (A/L)' },
                        ].map((m) => (
                            <button
                                key={m.val}
                                className={`course-status-tab ${filterMode === m.val ? 'active' : ''}`}
                                onClick={() => { setFilterMode(m.val); setFilterRange(''); setFilterYear(''); setFilterGrade(''); }}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Filters row ── */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
                        {filterMode === 'range' ? (
                            <select className="form-input" style={{ width: 230 }} value={filterRange} onChange={(e) => setFilterRange(e.target.value)}>
                                <option value="">All grade ranges</option>
                                {GRADE_RANGES.map((r) => <option key={r.val} value={r.val}>{r.label}</option>)}
                            </select>
                        ) : (
                            <>
                                <select className="form-input" style={{ width: 190 }} value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterGrade(''); }}>
                                    <option value="">All academic years</option>
                                    {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                                </select>
                                <select className="form-input" style={{ width: 220 }} value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} disabled={!filterYear}>
                                    <option value="">All A/L grades</option>
                                    {filteredGrades.filter((g) => g.gradeNumber >= 12).sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                        <option key={g._id} value={g._id}>{g.name} ({g.stream})</option>
                                    ))}
                                </select>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {[
                                { val: '', label: 'All' },
                                { val: 'mandatory', label: 'Mandatory' },
                                { val: 'bucket', label: 'Electives' },
                            ].map((t) => (
                                <button key={t.val} className={`course-status-tab ${filterType === t.val ? 'active' : ''}`} onClick={() => setFilterType(t.val)}>{t.label}</button>
                            ))}
                        </div>

                        <input
                            className="form-input"
                            style={{ flex: 1, minWidth: 200 }}
                            placeholder="Search by name, code, bucket…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* ── Stats strip ── */}
                    <div className="subject-stats-strip">
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val">{subjects.length}</span><span className="subject-stats-strip__label">Total</span></div>
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val" style={{ color: '#4F46E5' }}>{mandatorySubjects.length}</span><span className="subject-stats-strip__label">Mandatory</span></div>
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val" style={{ color: '#7C3AED' }}>{Object.keys(bucketGroups).length}</span><span className="subject-stats-strip__label">Buckets</span></div>
                    </div>

                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📖</div>
                            <p>No subjects found.</p>
                            {user?.role === 'admin' && <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreate}>Add subject</button>}
                        </div>
                    ) : (
                        <>
                            {mandatorySubjects.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-xl)' }}>
                                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--color-text-primary)' }}>📌 Mandatory subjects</h3>
                                    <SubjectTable subjects={mandatorySubjects} user={user} openEdit={openEdit} openAssignmentManager={openAssignmentManager} handleDelete={handleDelete} deletingId={deletingId} setViewSubject={setViewSubject} />
                                </div>
                            )}

                            {Object.entries(bucketGroups).map(([bucketName, list]) => (
                                <div key={bucketName} style={{ marginBottom: 'var(--space-xl)' }}>
                                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--color-primary)' }}>
                                        🪣 {bucketName} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}>(choose one)</span>
                                    </h3>
                                    <SubjectTable subjects={list} user={user} openEdit={openEdit} openAssignmentManager={openAssignmentManager} handleDelete={handleDelete} deletingId={deletingId} setViewSubject={setViewSubject} />
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* ── Create / Edit Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">{editSubject ? 'Edit subject' : 'Add subject'}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        {formError && <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>{formError}</div>}

                        <form className="modal__body" onSubmit={handleSave}>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Subject name *</label>
                                    <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Mathematics" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subject code *</label>
                                    <input className="form-input" name="code" value={form.code} onChange={handleChange} required placeholder="e.g. MATH" style={{ textTransform: 'uppercase' }} />
                                </div>
                            </div>

                            {/* Scope mode toggle */}
                            <div className="form-group">
                                <label className="form-label">Subject scope</label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <button
                                        type="button"
                                        className={`course-status-tab ${form.scopeMode === 'range' ? 'active' : ''}`}
                                        onClick={() => setForm((f) => ({ ...f, scopeMode: 'range', grade: '', academicYear: '' }))}
                                        disabled={!!editSubject}
                                    >
                                        📏 Grade range
                                    </button>
                                    <button
                                        type="button"
                                        className={`course-status-tab ${form.scopeMode === 'specific' ? 'active' : ''}`}
                                        onClick={() => setForm((f) => ({ ...f, scopeMode: 'specific', gradeRange: '' }))}
                                        disabled={!!editSubject}
                                    >
                                        🎯 Specific grade (A/L stream)
                                    </button>
                                </div>
                                {editSubject && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        Scope mode can't be changed after creation — delete and recreate if needed.
                                    </p>
                                )}
                            </div>

                            {form.scopeMode === 'range' ? (
                                <div className="form-group">
                                    <label className="form-label">Grade range *</label>
                                    <select className="form-input" name="gradeRange" value={form.gradeRange} onChange={handleChange} disabled={!!editSubject} required>
                                        <option value="">Select range</option>
                                        {GRADE_RANGES.map((r) => <option key={r.val} value={r.val}>{r.label}</option>)}
                                    </select>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        Auto-applies to every student whose grade falls in this range, every academic year — created once, no need to recreate yearly.
                                    </p>
                                </div>
                            ) : (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Academic year *</label>
                                        <select className="form-input" name="academicYear" value={form.academicYear} onChange={(e) => { handleChange(e); setForm((f) => ({ ...f, grade: '' })); }} disabled={!!editSubject} required>
                                            <option value="">Select year</option>
                                            {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Grade (stream) *</label>
                                        <select className="form-input" name="grade" value={form.grade} onChange={handleChange} disabled={!!editSubject || !form.academicYear} required>
                                            <option value="">Select grade</option>
                                            {formGrades.sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                                <option key={g._id} value={g._id}>{g.name} ({g.stream})</option>
                                            ))}
                                        </select>
                                        {selectedFormGrade && (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: 4 }}>
                                                This subject will only apply to {selectedFormGrade.stream} stream students in {selectedFormGrade.name}.
                                            </p>
                                        )}
                                        {formGrades.length === 0 && form.academicYear && (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                No A/L grades (12-13) found for this year. Create one under Grades first.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Mandatory vs Bucket toggle */}
                            <div className="form-group">
                                <label className="form-label">Subject type</label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <button type="button" className={`course-status-tab ${form.isMandatory ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, isMandatory: true, bucket: '' }))}>📌 Mandatory</button>
                                    <button type="button" className={`course-status-tab ${!form.isMandatory ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, isMandatory: false }))}>🪣 Bucket / Elective</button>
                                </div>
                            </div>

                            {!form.isMandatory && (
                                <div className="form-group">
                                    <label className="form-label">Bucket name *</label>
                                    <input className="form-input" name="bucket" value={form.bucket} onChange={handleChange} required placeholder='e.g. "scienceBucket", "ictBucket", "commerceBucket", "religion"' />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        Subjects sharing the same bucket name become alternatives — a student picks ONE per bucket. Free-form text, define your own per stream/grade.
                                    </p>
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Credits</label>
                                    <input className="form-input" type="number" name="credits" value={form.credits} onChange={handleChange} min={1} max={10} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Semester</label>
                                    <select className="form-input" name="semester" value={form.semester} onChange={handleChange}>
                                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Semester {n}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" name="description" value={form.description} onChange={handleChange} rows={2} style={{ resize: 'vertical' }} />
                            </div>

                            {/* Schedule */}
                            <div className="form-group">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                                    <label className="form-label" style={{ margin: 0 }}>Schedule</label>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={addScheduleSlot}>+ Add slot</button>
                                </div>
                                {form.schedule.map((slot, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', alignItems: 'center' }}>
                                        <select className="form-input" value={slot.day} onChange={(e) => updateScheduleSlot(idx, 'day', e.target.value)}>
                                            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <input className="form-input" type="time" value={slot.startTime} onChange={(e) => updateScheduleSlot(idx, 'startTime', e.target.value)} />
                                        <input className="form-input" type="time" value={slot.endTime} onChange={(e) => updateScheduleSlot(idx, 'endTime', e.target.value)} />
                                        <input className="form-input" placeholder="Room" value={slot.room} onChange={(e) => updateScheduleSlot(idx, 'room', e.target.value)} />
                                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => removeScheduleSlot(idx)}>✕</button>
                                    </div>
                                ))}
                            </div>

                            {!editSubject && (
                                <div style={{
                                    background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-md)', fontSize: '0.875rem', color: '#2563EB',
                                    display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start',
                                }}>
                                    <span style={{ flexShrink: 0 }}>ℹ</span>
                                    <span>
                    Teacher assignment happens after creation. Once saved, use the
                    "👨‍🏫 Manage teachers" button to assign a different teacher to each section.
                  </span>
                                </div>
                            )}

                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner" /> Saving…</> : editSubject ? 'Update subject' : 'Create subject'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Teacher Assignment Manager modal ── */}
            {assignmentModalSubject && (
                <div className="modal-overlay" onClick={() => setAssignmentModalSubject(null)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">Teachers — {assignmentModalSubject.name}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setAssignmentModalSubject(null)}>✕</button>
                        </div>
                        <div className="modal__body">
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                                Assign a different teacher to each section.{' '}
                                {assignmentModalSubject.gradeRange
                                    ? `This subject spans grade range ${assignmentModalSubject.gradeRange} — every matching section is listed below.`
                                    : `This subject is specific to ${assignmentModalSubject.grade?.name || 'one grade'}.`}
                            </p>

                            {assignmentError && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{assignmentError}</div>}

                            {/* Add new row */}
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                                <select className="form-input" value={newRowSection} onChange={(e) => setNewRowSection(e.target.value)} style={{ flex: 1, minWidth: 160 }} disabled={sectionsLoading}>
                                    <option value="">{sectionsLoading ? 'Loading sections…' : 'Select section'}</option>
                                    {unassignedSections.map((s) => (
                                        <option key={s._id} value={s._id}>
                                            {s.grade?.gradeNumber}{s.name}{s.grade?.stream && s.grade.stream !== 'none' ? ` (${s.grade.stream})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <select className="form-input" value={newRowTeacher} onChange={(e) => setNewRowTeacher(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
                                    <option value="">Select teacher</option>
                                    {teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                                </select>
                                <button className="btn btn-primary btn-sm" onClick={handleAddRow} disabled={!newRowSection || !newRowTeacher || savingRow}>
                                    {savingRow ? <span className="spinner" /> : '+ Add'}
                                </button>
                            </div>

                            {unassignedSections.length === 0 && !sectionsLoading && assignmentSections.length > 0 && (
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                                    All sections in this subject's scope already have a teacher assigned.
                                </p>
                            )}
                            {assignmentSections.length === 0 && !sectionsLoading && (
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                                    No sections exist yet within this subject's scope. Create sections first.
                                </p>
                            )}

                            {/* Existing assignments list */}
                            {assignmentsLoading ? (
                                <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                    <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                </div>
                            ) : assignments.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                    <div className="empty-state__icon">👨‍🏫</div>
                                    <p>No teachers assigned yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
                                    {assignments.map((a) => (
                                        <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)', minWidth: 60 }}>
                        {a.section?.grade?.gradeNumber}{a.section?.name}
                      </span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{a.teacher?.name}</div>
                                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{a.teacher?.email}</div>
                                            </div>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleRemoveRow(a._id)}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="modal__footer">
                                <button className="btn btn-ghost" onClick={() => setAssignmentModalSubject(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── View modal ── */}
            {viewSubject && (
                <div className="modal-overlay" onClick={() => setViewSubject(null)}>
                    <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">{viewSubject.name}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setViewSubject(null)}>✕</button>
                        </div>
                        <div className="modal__body">
                            {[
                                { label: 'Code',     val: viewSubject.code },
                                { label: 'Scope',    val: viewSubject.gradeRange ? `Grade range ${viewSubject.gradeRange} (all years)` : `${viewSubject.grade?.name || '—'} (${viewSubject.grade?.stream || ''})` },
                                { label: 'Type',     val: viewSubject.isMandatory ? 'Mandatory' : `Bucket: ${viewSubject.bucket}` },
                                { label: 'Semester', val: `Semester ${viewSubject.semester}` },
                                { label: 'Credits',  val: viewSubject.credits },
                                { label: 'Description', val: viewSubject.description || '—' },
                            ].map(({ label, val }) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
                                    <span style={{ color: 'var(--color-text-primary)', textAlign: 'right', maxWidth: '60%' }}>{val}</span>
                                </div>
                            ))}
                            <div className="modal__footer">
                                <button className="btn btn-ghost" onClick={() => setViewSubject(null)}>Close</button>
                                {user?.role === 'admin' && (
                                    <button className="btn btn-outline" onClick={() => { setViewSubject(null); openAssignmentManager(viewSubject); }}>
                                        👨‍🏫 Manage teachers
                                    </button>
                                )}
                                {user?.role === 'admin' && <button className="btn btn-primary" onClick={() => { setViewSubject(null); openEdit(viewSubject); }}>Edit</button>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SubjectTable({ subjects, user, openEdit, openAssignmentManager, handleDelete, deletingId, setViewSubject }) {
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
                <thead>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Scope</th>
                    <th>Semester</th>
                    <th>Credits</th>
                    {user?.role === 'admin' && <th>Actions</th>}
                </tr>
                </thead>
                <tbody>
                {subjects.map((s) => (
                    <tr key={s._id}>
                        <td><span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>{s.code}</span></td>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            {s.gradeRange
                                ? <span style={{ color: '#059669', fontWeight: 600 }}>📏 {s.gradeRange}</span>
                                : <span>{s.grade?.name}{s.grade?.stream ? ` (${s.grade.stream})` : ''}</span>
                            }
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>S{s.semester}</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>{s.credits}</td>
                        {user?.role === 'admin' && (
                            <td>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setViewSubject(s)} title="View">👁</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => openAssignmentManager(s)}>👨‍🏫 Teachers</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s._id, s.name)} disabled={deletingId === s._id}>{deletingId === s._id ? '…' : 'Del'}</button>
                                </div>
                            </td>
                        )}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}