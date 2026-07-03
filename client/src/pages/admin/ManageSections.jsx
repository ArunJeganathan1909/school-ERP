import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchAcademicYears } from '../../store/slices/academicYearSlice';
import { fetchGrades } from '../../store/slices/gradeSlice';
import { fetchSections, createSection, updateSection, deleteSection, clearSectionError } from '../../store/slices/sectionSlice';
import {
    assignStudentToSection, transferStudent, withdrawStudent,
    fetchAllStudentSections, clearStudentSectionError, clearLastResult,
} from '../../store/slices/studentSectionSlice';
import { syncStudentEnrollments, clearSyncMessage } from '../../store/slices/subjectEnrollmentSlice';
import api from '../../api/axios';
import './ManageSections.css';

const EMPTY = { grade: '', academicYear: '', name: '', classTeacher: '', capacity: 40, room: '' };

export default function ManageSections() {
    const dispatch = useDispatch();
    const { list: years }    = useSelector((s) => s.academicYears);
    const { list: grades }   = useSelector((s) => s.grades);
    const { list: sections, loading, error } = useSelector((s) => s.sections);
    const { list: activeAssignments, lastResult } = useSelector((s) => s.studentSections);
    const { lastSyncMessage, syncing } = useSelector((s) => s.subjectEnrollments);

    const [filterYear,  setFilterYear]  = useState('');
    const [filterGrade, setFilterGrade] = useState('');
    const [teachers,    setTeachers]    = useState([]);
    const [showModal,   setShowModal]   = useState(false);
    const [editSection, setEditSection] = useState(null);
    const [form,        setForm]        = useState(EMPTY);
    const [saving,      setSaving]      = useState(false);
    const [formError,   setFormError]   = useState('');

    const [selectedSection, setSelectedSection] = useState(null);
    const [sectionStudents, setSectionStudents] = useState([]);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [assignStudentId, setAssignStudentId] = useState('');
    const [rollNumber,      setRollNumber]      = useState('');
    const [assignError,     setAssignError]     = useState('');
    const [assigning,       setAssigning]       = useState(false);
    const [allStudents,     setAllStudents]     = useState([]);
    const [transferTarget,  setTransferTarget]  = useState(null); // student record being transferred
    const [syncingId,       setSyncingId]       = useState(null); // which student row is currently syncing

    useEffect(() => {
        dispatch(fetchAcademicYears());
        api.get('/users?role=teacher&limit=100').then(({ data }) => setTeachers(data.users || []));
        api.get('/users?role=student&limit=500').then(({ data }) => setAllStudents(data.users || []));
    }, [dispatch]);

    useEffect(() => { if (filterYear) dispatch(fetchGrades({ academicYear: filterYear })); }, [dispatch, filterYear]);

    useEffect(() => {
        const params = {};
        if (filterYear)  params.academicYear = filterYear;
        if (filterGrade) params.grade        = filterGrade;
        dispatch(fetchSections(params));
    }, [dispatch, filterYear, filterGrade]);

    // School-wide active assignments for the selected year — used to keep a
    // student from being offered for a second section while already active
    // in one elsewhere (a student can only hold one active section per year).
    useEffect(() => {
        if (filterYear) dispatch(fetchAllStudentSections({ academicYear: filterYear, status: 'active' }));
    }, [dispatch, filterYear]);

    useEffect(() => { if (selectedSection) loadSectionStudents(selectedSection._id); }, [selectedSection]);

    const loadSectionStudents = async (sectionId) => {
        setStudentsLoading(true);
        try {
            const { data } = await api.get(`/sections/${sectionId}/students`);
            setSectionStudents(data.students || []);
        } catch { setSectionStudents([]); }
        setStudentsLoading(false);
    };

    const openCreate = () => { setEditSection(null); setForm({ ...EMPTY, academicYear: filterYear || '', grade: filterGrade || '' }); setFormError(''); setShowModal(true); };
    const openEdit = (s) => {
        setEditSection(s);
        setForm({
            grade: s.grade?._id || s.grade || '',
            academicYear: s.academicYear?._id || s.academicYear || '',
            name: s.name,
            classTeacher: s.classTeacher?._id || s.classTeacher || '',
            capacity: s.capacity,
            room: s.room || '',
        });
        setFormError('');
        setShowModal(true);
    };

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');
        dispatch(clearSectionError());
        const payload = { ...form, classTeacher: form.classTeacher || null };
        const result = editSection
            ? await dispatch(updateSection({ id: editSection._id, data: payload }))
            : await dispatch(createSection(payload));
        setSaving(false);
        if (result.error) { setFormError(result.payload || 'Save failed'); return; }
        setShowModal(false);
    };

    const handleDelete = (s) => {
        if (!window.confirm(`Delete section "${s.displayName || s.name}"? All data will be removed.`)) return;
        dispatch(deleteSection(s._id));
        if (selectedSection?._id === s._id) setSelectedSection(null);
    };

    const handleAssignStudent = async (e) => {
        e.preventDefault();
        if (!assignStudentId || !selectedSection) return;
        setAssigning(true);
        setAssignError('');
        dispatch(clearLastResult());
        const result = await dispatch(assignStudentToSection({ studentId: assignStudentId, sectionId: selectedSection._id, rollNumber }));
        setAssigning(false);
        if (result.error) { setAssignError(result.payload || 'Assignment failed'); return; }
        setAssignStudentId('');
        setRollNumber('');
        loadSectionStudents(selectedSection._id);
        dispatch(fetchAllStudentSections({ academicYear: filterYear, status: 'active' }));
    };

    const handleTransfer = async (newSectionId) => {
        if (!transferTarget) return;
        dispatch(clearLastResult());
        const result = await dispatch(transferStudent({
            studentId: transferTarget.student._id,
            newSectionId,
            transferNote: 'Transferred via admin panel',
        }));
        setTransferTarget(null);
        if (!result.error) {
            loadSectionStudents(selectedSection._id);
            dispatch(fetchAllStudentSections({ academicYear: filterYear, status: 'active' }));
        }
    };

    const handleWithdraw = async (recordId) => {
        if (!window.confirm('Withdraw this student from the section? All subject enrollments will be dropped.')) return;
        await dispatch(withdrawStudent(recordId));
        loadSectionStudents(selectedSection._id);
        dispatch(fetchAllStudentSections({ academicYear: filterYear, status: 'active' }));
    };

    // Retroactively sync mandatory subjects for one student — needed when a
    // student was assigned to a section BEFORE matching subjects were created.
    const handleSync = async (studentId) => {
        setSyncingId(studentId);
        dispatch(clearSyncMessage());
        const result = await dispatch(syncStudentEnrollments(studentId));
        setSyncingId(null);
        if (!result.error) {
            alert(result.payload.message);
        } else {
            alert(result.payload || 'Sync failed');
        }
    };

    const filteredGrades   = filterYear ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === filterYear) : grades;
    // A student can only hold one active section per academic year (enforced
    // by a unique index on the backend), so anyone active in ANY section this
    // year — not just the one currently selected — must be excluded here.
    const globallyAssignedIds = new Set(activeAssignments.map((r) => r.student?._id || r.student));
    const unassigned          = allStudents.filter((s) => !globallyAssignedIds.has(s._id));

    // Sections in same grade but different section (for transfer target list) — also allow cross-grade
    const transferOptions = sections.filter((s) => s._id !== selectedSection?._id);

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Sections</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <button className="btn btn-primary" onClick={openCreate} disabled={!filterYear}>+ Add section</button>
                    </div>
                </div>

                <div className="page-body">
                    <div className="section-filters">
                        <select className="form-input" style={{ width: 200 }} value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterGrade(''); }}>
                            <option value="">Select academic year</option>
                            {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                        </select>
                        <select className="form-input" style={{ width: 220 }} value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} disabled={!filterYear}>
                            <option value="">All grades</option>
                            {[...filteredGrades].sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                <option key={g._id} value={g._id}>{g.name}{g.stream !== 'none' ? ` (${g.stream})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    {!filterYear && <div className="alert alert-info">Select an academic year to view and manage sections.</div>}
                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}
                    {lastResult?.message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-lg)' }}>{lastResult.message}</div>}
                    {lastSyncMessage && <div className="alert alert-success" style={{ marginBottom: 'var(--space-lg)' }}>{lastSyncMessage}</div>}

                    {filterYear && (
                        <div className="sections-layout">
                            <div className="sections-list">
                                {loading && sections.length === 0 ? (
                                    <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div>
                                ) : sections.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state__icon">🏫</div>
                                        <p>No sections found.</p>
                                        <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreate}>Add section</button>
                                    </div>
                                ) : (
                                    sections.map((s) => {
                                        const display = `${s.grade?.gradeNumber || ''}${s.name}`;
                                        const isSelected = selectedSection?._id === s._id;
                                        return (
                                            <div key={s._id} className={`section-card card ${isSelected ? 'section-card--selected' : ''}`} onClick={() => setSelectedSection(isSelected ? null : s)}>
                                                <div className="section-card__header">
                                                    <div>
                                                        <div className="section-card__display">{display}</div>
                                                        {s.grade?.stream && s.grade.stream !== 'none' && (
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{s.grade.stream} stream</span>
                                                        )}
                                                    </div>
                                                    <div className="section-card__actions" onClick={(e) => e.stopPropagation()}>
                                                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s)}>Del</button>
                                                    </div>
                                                </div>
                                                <div className="section-card__meta">
                                                    <span>👨‍🏫 {s.classTeacher?.name || 'No class teacher'}</span>
                                                    <span>👥 {s.studentCount ?? 0} / {s.capacity}</span>
                                                </div>
                                                {s.room && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>🏠 {s.room}</div>}
                                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Semester {s.currentSemester}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {selectedSection && (
                                <div className="student-panel card">
                                    <div className="student-panel__header">
                                        <h3>Students in {selectedSection.grade?.gradeNumber}{selectedSection.name}</h3>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{sectionStudents.length} / {selectedSection.capacity}</span>
                                    </div>

                                    <form className="assign-form" onSubmit={handleAssignStudent}>
                                        <div className="assign-form__fields">
                                            <select className="form-input" value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} required>
                                                <option value="">Select student to assign</option>
                                                {unassigned.map((st) => <option key={st._id} value={st._id}>{st.name} ({st.email})</option>)}
                                            </select>
                                            <input className="form-input" placeholder="Roll no. (optional)" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} style={{ width: 140, flexShrink: 0 }} />
                                            <button type="submit" className="btn btn-primary btn-sm" disabled={assigning || !assignStudentId}>
                                                {assigning ? <span className="spinner" /> : '+ Assign'}
                                            </button>
                                        </div>
                                        {assignError && <div className="alert alert-error" style={{ marginTop: 'var(--space-sm)' }}>{assignError}</div>}
                                    </form>

                                    {studentsLoading ? (
                                        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}><div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div>
                                    ) : sectionStudents.length === 0 ? (
                                        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}><div className="empty-state__icon">👥</div><p>No students assigned yet.</p></div>
                                    ) : (
                                        <div className="student-panel__list">
                                            {sectionStudents.map((record) => (
                                                <div key={record._id} className="student-panel__row">
                                                    <div className="student-panel__avatar">{record.student?.name?.charAt(0).toUpperCase()}</div>
                                                    <div className="student-panel__info">
                                                        <div className="student-panel__name">{record.student?.name}</div>
                                                        <div className="student-panel__email">{record.student?.email}</div>
                                                    </div>
                                                    <div className="student-panel__roll">{record.rollNumber || <span style={{ color: 'var(--color-text-muted)' }}>No roll no.</span>}</div>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleSync(record.student._id)}
                                                        disabled={syncingId === record.student._id}
                                                        title="Sync mandatory subjects (use if subjects were created after this student was assigned)"
                                                    >
                                                        {syncingId === record.student._id ? <span className="spinner" /> : '🔄'}
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setTransferTarget(record)} title="Transfer to another section">⇄</button>
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)', flexShrink: 0 }} onClick={() => handleWithdraw(record._id)} title="Withdraw from section">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Section create/edit modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">{editSection ? 'Edit section' : 'New section'}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        {formError && <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>{formError}</div>}
                        <form className="modal__body" onSubmit={handleSave}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Academic year *</label>
                                    <select className="form-input" name="academicYear" value={form.academicYear} onChange={handleChange} required>
                                        <option value="">Select year</option>
                                        {years.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Grade *</label>
                                    <select className="form-input" name="grade" value={form.grade} onChange={handleChange} required>
                                        <option value="">Select grade</option>
                                        {[...filteredGrades].sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                            <option key={g._id} value={g._id}>{g.name}{g.stream !== 'none' ? ` (${g.stream})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Section name *</label>
                                    <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. A, B, C" style={{ textTransform: 'uppercase' }} maxLength={3} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Room / Class</label>
                                    <input className="form-input" name="room" value={form.room} onChange={handleChange} placeholder="e.g. Room 201" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Class teacher</label>
                                <select className="form-input" name="classTeacher" value={form.classTeacher} onChange={handleChange}>
                                    <option value="">— No class teacher —</option>
                                    {teachers.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.email})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Capacity</label>
                                <input className="form-input" type="number" name="capacity" value={form.capacity} onChange={handleChange} min={1} max={100} />
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner" /> Saving…</> : editSection ? 'Update' : 'Create section'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer modal */}
            {transferTarget && (
                <div className="modal-overlay" onClick={() => setTransferTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">Transfer {transferTarget.student?.name}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setTransferTarget(null)}>✕</button>
                        </div>
                        <div className="modal__body">
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                                Mandatory subjects will be re-enrolled automatically. Bucket subjects will only be dropped if not offered in the new section.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Transfer to section</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', maxHeight: 240, overflowY: 'auto' }}>
                                    {transferOptions.map((s) => (
                                        <button key={s._id} className="btn btn-outline" style={{ justifyContent: 'flex-start' }} onClick={() => handleTransfer(s._id)}>
                                            Grade {s.grade?.gradeNumber}{s.name} {s.grade?.stream !== 'none' ? `(${s.grade?.stream})` : ''} — {s.studentCount ?? 0}/{s.capacity}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}