import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import api from '../../api/axios';
import './ManageSubjects.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const GRADE_RANGES = [
    { val: '1-5',   label: 'Grade 1–5 (Primary)' },
    { val: '6-9',   label: 'Grade 6–9 (Junior Secondary)' },
    { val: '10-11', label: 'Grade 10–11 (O/L)' },
    { val: '12-13', label: 'Grade 12–13 (A/L)' },
];

const EMPTY_FORM = {
    name: '', code: '', grade: '', academicYear: '',
    isMandatory: true, bucket: '', gradeRange: '',
    teacher: '', section: '', credits: 3, description: '', semester: 1, schedule: [],
};
const EMPTY_SCHEDULE = { day: 'Monday', startTime: '09:00', endTime: '10:30', room: '' };

export default function ManageSubjects() {
    const { user } = useSelector((s) => s.auth);

    const [subjects,  setSubjects]  = useState([]);
    const [years,     setYears]     = useState([]);
    const [grades,    setGrades]    = useState([]);
    const [sections,  setSections]  = useState([]);
    const [teachers,  setTeachers]  = useState([]);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState('');

    // Filters
    const [filterYear,     setFilterYear]     = useState('');
    const [filterGrade,    setFilterGrade]    = useState('');
    const [filterType,     setFilterType]     = useState(''); // '' | 'mandatory' | 'bucket'
    const [search,         setSearch]         = useState('');

    // Modal
    const [showModal,   setShowModal]   = useState(false);
    const [editSubject, setEditSubject] = useState(null);
    const [form,        setForm]        = useState(EMPTY_FORM);
    const [saving,      setSaving]      = useState(false);
    const [formError,   setFormError]   = useState('');
    const [deletingId,  setDeletingId]  = useState(null);
    const [viewSubject, setViewSubject] = useState(null);

    // Teacher-assignment modal (per section)
    const [teacherModalSubject, setTeacherModalSubject] = useState(null);
    const [teacherAssignSection, setTeacherAssignSection] = useState('');
    const [teacherAssignTeacher, setTeacherAssignTeacher] = useState('');
    const [assigningTeacher, setAssigningTeacher] = useState(false);

    useEffect(() => {
        fetchYears();
        fetchTeachers();
    }, []);

    useEffect(() => { if (filterYear) fetchGrades(filterYear); }, [filterYear]);
    useEffect(() => { if (filterGrade) fetchSections(filterGrade); }, [filterGrade]);
    useEffect(() => { fetchSubjects(); }, [filterYear, filterGrade, filterType]);

    // For the form: load grades/sections for the academic year/grade selected inside the modal
    useEffect(() => { if (form.academicYear) fetchGrades(form.academicYear); }, [form.academicYear]);
    useEffect(() => { if (form.grade) fetchSections(form.grade); }, [form.grade]);

    const fetchSubjects = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (filterYear)  params.append('academicYear', filterYear);
            if (filterGrade) params.append('grade', filterGrade);
            if (filterType)  params.append('isMandatory', filterType === 'mandatory' ? 'true' : 'false');
            const { data } = await api.get(`/subjects?${params}`);
            setSubjects(data.subjects || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load subjects');
        }
        setLoading(false);
    };

    const fetchYears    = async () => { try { const { data } = await api.get('/academic-years'); setYears(data.years || []); } catch { setYears([]); } };
    const fetchGrades   = async (yearId) => { try { const { data } = await api.get(`/grades?academicYear=${yearId}`); setGrades(data.grades || []); } catch { setGrades([]); } };
    const fetchSections = async (gradeId) => { try { const { data } = await api.get(`/sections?grade=${gradeId}`); setSections(data.sections || []); } catch { setSections([]); } };
    const fetchTeachers = async () => { try { const { data } = await api.get('/users?role=teacher&limit=100'); setTeachers(data.users || []); } catch { setTeachers([]); } };

    const openCreate = () => {
        setEditSubject(null);
        setForm({
            ...EMPTY_FORM,
            academicYear: filterYear  || '',
            grade:        filterGrade || '',
        });
        setFormError('');
        setShowModal(true);
    };

    const openEdit = (subject) => {
        setEditSubject(subject);
        setForm({
            name:         subject.name         || '',
            code:         subject.code         || '',
            grade:        subject.grade?._id   || subject.grade   || '',
            academicYear: subject.academicYear?._id || subject.academicYear || '',
            isMandatory:  subject.isMandatory,
            bucket:       subject.bucket       || '',
            gradeRange:   subject.gradeRange   || '',
            teacher:      subject.teacher?._id || subject.teacher || '',
            section:      subject.section?._id || subject.section || '',
            credits:      subject.credits      ?? 3,
            description:  subject.description || '',
            semester:     subject.semester     ?? 1,
            schedule:     subject.schedule     || [],
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

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');

        const payload = {
            name:         form.name,
            code:         form.code,
            grade:        form.grade || null,
            academicYear: form.academicYear || null,
            isMandatory:  form.isMandatory,
            bucket:       form.isMandatory ? null : form.bucket.trim(),
            gradeRange:   form.isMandatory ? (form.gradeRange || null) : null,
            teacher:      form.teacher || null,
            section:      form.teacher ? (form.section || null) : null, // section only relevant when assigning a teacher
            credits:      Number(form.credits),
            description:  form.description,
            semester:     Number(form.semester),
            schedule:     form.schedule,
        };

        if (!payload.isMandatory && !payload.bucket) {
            setFormError('Bucket name is required for elective subjects (e.g. "scienceBucket", "ictBucket", "religion")');
            setSaving(false);
            return;
        }

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
        if (!window.confirm(`Delete subject "${name}"?`)) return;
        setDeletingId(id);
        try {
            await api.delete(`/subjects/${id}`);
            setSubjects((prev) => prev.filter((s) => s._id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
        setDeletingId(null);
    };

    // ── Teacher-per-section assignment modal ──
    const openTeacherModal = (subject) => {
        setTeacherModalSubject(subject);
        setTeacherAssignSection(subject.section?._id || subject.section || '');
        setTeacherAssignTeacher(subject.teacher?._id || subject.teacher || '');
        if (subject.grade) fetchSections(subject.grade?._id || subject.grade);
    };

    const handleAssignTeacher = async () => {
        if (!teacherModalSubject) return;
        setAssigningTeacher(true);
        try {
            await api.put(`/subjects/${teacherModalSubject._id}`, {
                teacher: teacherAssignTeacher || null,
                section: teacherAssignTeacher ? (teacherAssignSection || null) : null,
            });
            setTeacherModalSubject(null);
            fetchSubjects();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to assign teacher');
        }
        setAssigningTeacher(false);
    };

    const filtered = subjects.filter((s) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q) || s.bucket?.toLowerCase().includes(q) || s.teacher?.name?.toLowerCase().includes(q);
    });

    const formGrades = form.academicYear ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === form.academicYear) : grades;
    const filteredGrades = filterYear ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === filterYear) : grades;
    const selectedFormGrade = formGrades.find((g) => g._id === form.grade);

    // Group subjects by bucket for display clarity
    const mandatorySubjects = filtered.filter((s) => s.isMandatory);
    const bucketGroups = filtered.filter((s) => !s.isMandatory).reduce((acc, s) => {
        if (!acc[s.bucket]) acc[s.bucket] = [];
        acc[s.bucket].push(s);
        return acc;
    }, {});

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
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <select className="form-input" style={{ width: 190 }} value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterGrade(''); }}>
                            <option value="">All academic years</option>
                            {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                        </select>
                        <select className="form-input" style={{ width: 220 }} value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} disabled={!filterYear}>
                            <option value="">All grades</option>
                            {filteredGrades.sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                <option key={g._id} value={g._id}>{g.name}{g.stream !== 'none' ? ` (${g.stream})` : ''}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {[
                                { val: '', label: 'All' },
                                { val: 'mandatory', label: 'Mandatory' },
                                { val: 'bucket', label: 'Electives' },
                            ].map((t) => (
                                <button key={t.val} className={`course-status-tab ${filterType === t.val ? 'active' : ''}`} onClick={() => setFilterType(t.val)}>{t.label}</button>
                            ))}
                        </div>
                        <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Search by name, code, bucket, teacher…" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>

                    {/* Stats strip */}
                    <div className="subject-stats-strip">
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val">{subjects.length}</span><span className="subject-stats-strip__label">Total</span></div>
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val" style={{ color: '#4F46E5' }}>{mandatorySubjects.length}</span><span className="subject-stats-strip__label">Mandatory</span></div>
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val" style={{ color: '#7C3AED' }}>{Object.keys(bucketGroups).length}</span><span className="subject-stats-strip__label">Buckets</span></div>
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val" style={{ color: '#059669' }}>{subjects.filter((s) => s.teacher).length}</span><span className="subject-stats-strip__label">With teacher</span></div>
                    </div>

                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                    {loading ? (
                        <div className="empty-state"><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📖</div>
                            <p>No subjects found.</p>
                            {user?.role === 'admin' && <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreate}>Add subject</button>}
                        </div>
                    ) : (
                        <>
                            {/* Mandatory subjects table */}
                            {mandatorySubjects.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-xl)' }}>
                                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--color-text-primary)' }}>📌 Mandatory subjects</h3>
                                    <SubjectTable subjects={mandatorySubjects} user={user} openEdit={openEdit} openTeacherModal={openTeacherModal} handleDelete={handleDelete} deletingId={deletingId} setViewSubject={setViewSubject} />
                                </div>
                            )}

                            {/* Bucket groups */}
                            {Object.entries(bucketGroups).map(([bucketName, list]) => (
                                <div key={bucketName} style={{ marginBottom: 'var(--space-xl)' }}>
                                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--color-primary)' }}>
                                        🪣 {bucketName} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}>(choose one)</span>
                                    </h3>
                                    <SubjectTable subjects={list} user={user} openEdit={openEdit} openTeacherModal={openTeacherModal} handleDelete={handleDelete} deletingId={deletingId} setViewSubject={setViewSubject} />
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
                                    <label className="form-label">Academic year *</label>
                                    <select className="form-input" name="academicYear" value={form.academicYear} onChange={(e) => { handleChange(e); setForm((f) => ({ ...f, grade: '' })); }} required>
                                        <option value="">Select year</option>
                                        {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Grade *</label>
                                    <select className="form-input" name="grade" value={form.grade} onChange={handleChange} disabled={!form.academicYear} required>
                                        <option value="">Select grade</option>
                                        {formGrades.sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                            <option key={g._id} value={g._id}>{g.name}{g.stream !== 'none' ? ` (${g.stream} stream)` : ''}</option>
                                        ))}
                                    </select>
                                    {selectedFormGrade?.gradeNumber >= 12 && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: 4 }}>
                                            A/L stream: {selectedFormGrade.stream}. This subject will only apply to this stream.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Subject name *</label>
                                    <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Chemistry" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subject code *</label>
                                    <input className="form-input" name="code" value={form.code} onChange={handleChange} required placeholder="e.g. CHEM12" style={{ textTransform: 'uppercase' }} />
                                </div>
                            </div>

                            {/* Mandatory vs Bucket toggle */}
                            <div className="form-group">
                                <label className="form-label">Subject type</label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <button type="button" className={`course-status-tab ${form.isMandatory ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, isMandatory: true, bucket: '' }))}>📌 Mandatory</button>
                                    <button type="button" className={`course-status-tab ${!form.isMandatory ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, isMandatory: false, gradeRange: '' }))}>🪣 Bucket / Elective</button>
                                </div>
                            </div>

                            {form.isMandatory ? (
                                <div className="form-group">
                                    <label className="form-label">Grade range (for auto-assignment)</label>
                                    <select className="form-input" name="gradeRange" value={form.gradeRange} onChange={handleChange}>
                                        <option value="">— Only this specific grade —</option>
                                        {GRADE_RANGES.map((r) => <option key={r.val} value={r.val}>{r.label}</option>)}
                                    </select>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        If set, this subject auto-enrolls every student whose grade falls in this range. Leave blank to apply only to the specific grade selected above.
                                    </p>
                                </div>
                            ) : (
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

                            {/* Teacher + Section (only needed together) */}
                            <div className="form-group" style={{ background: '#F9FAFB', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
                                <label className="form-label">Assign teacher (optional — choose section too)</label>
                                <div className="form-row">
                                    <select className="form-input" name="teacher" value={form.teacher} onChange={handleChange}>
                                        <option value="">— No teacher —</option>
                                        {teachers.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.email})</option>)}
                                    </select>
                                    <select className="form-input" name="section" value={form.section} onChange={handleChange} disabled={!form.teacher || !form.grade}>
                                        <option value="">— Select section —</option>
                                        {sections.map((s) => <option key={s._id} value={s._id}>{s.grade?.gradeNumber}{s.name}</option>)}
                                    </select>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                    A subject definition applies to the whole grade/stream. Teacher assignment is per-section — use "Assign teacher" on the table after creating to set different teachers for different sections of the same subject.
                                </p>
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

            {/* ── Teacher-per-section assignment modal ── */}
            {teacherModalSubject && (
                <div className="modal-overlay" onClick={() => setTeacherModalSubject(null)}>
                    <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">Assign teacher — {teacherModalSubject.name}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setTeacherModalSubject(null)}>✕</button>
                        </div>
                        <div className="modal__body">
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                                Teacher assignment is scoped to a section — pick which section this teacher covers for this subject.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Teacher</label>
                                <select className="form-input" value={teacherAssignTeacher} onChange={(e) => setTeacherAssignTeacher(e.target.value)}>
                                    <option value="">— No teacher —</option>
                                    {teachers.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.email})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Section</label>
                                <select className="form-input" value={teacherAssignSection} onChange={(e) => setTeacherAssignSection(e.target.value)} disabled={!teacherAssignTeacher}>
                                    <option value="">— Select section —</option>
                                    {sections.map((s) => <option key={s._id} value={s._id}>{s.grade?.gradeNumber}{s.name}</option>)}
                                </select>
                            </div>
                            <div className="modal__footer">
                                <button className="btn btn-ghost" onClick={() => setTeacherModalSubject(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleAssignTeacher} disabled={assigningTeacher}>
                                    {assigningTeacher ? <span className="spinner" /> : 'Save assignment'}
                                </button>
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
                                { label: 'Code', val: viewSubject.code },
                                { label: 'Grade', val: viewSubject.grade?.name || '—' },
                                { label: 'Type', val: viewSubject.isMandatory ? 'Mandatory' : `Bucket: ${viewSubject.bucket}` },
                                { label: 'Grade range', val: viewSubject.gradeRange || 'Specific grade only' },
                                { label: 'Teacher', val: viewSubject.teacher?.name || 'Unassigned' },
                                { label: 'Section (for teacher)', val: viewSubject.section?.name || '—' },
                                { label: 'Semester', val: `Semester ${viewSubject.semester}` },
                                { label: 'Credits', val: viewSubject.credits },
                                { label: 'Description', val: viewSubject.description || '—' },
                            ].map(({ label, val }) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
                                    <span style={{ color: 'var(--color-text-primary)', textAlign: 'right', maxWidth: '60%' }}>{val}</span>
                                </div>
                            ))}
                            <div className="modal__footer">
                                <button className="btn btn-ghost" onClick={() => setViewSubject(null)}>Close</button>
                                {user?.role === 'admin' && <button className="btn btn-outline" onClick={() => { setViewSubject(null); openEdit(viewSubject); }}>Edit</button>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SubjectTable({ subjects, user, openEdit, openTeacherModal, handleDelete, deletingId, setViewSubject }) {
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
                <thead>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Grade</th>
                    <th>Teacher (Section)</th>
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
                            {s.grade?.name || '—'}{s.gradeRange && <span style={{ color: 'var(--color-text-muted)' }}> · {s.gradeRange}</span>}
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            {s.teacher?.name
                                ? <>{s.teacher.name} {s.section?.name && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>({s.grade?.gradeNumber}{s.section.name})</span>}</>
                                : <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>
                            }
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>S{s.semester}</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>{s.credits}</td>
                        {user?.role === 'admin' && (
                            <td>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setViewSubject(s)} title="View">👁</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => openTeacherModal(s)}>👨‍🏫</button>
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