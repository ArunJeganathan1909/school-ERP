import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchAcademicYears } from '../../store/slices/academicYearSlice';
import { fetchGrades } from '../../store/slices/gradeSlice';
import { fetchSections } from '../../store/slices/sectionSlice';
import {
    fetchPendingBuckets, assignBucketSubject, changeBucketSubject,
    fetchStudentSubjects, clearSubjectEnrollmentError,
} from '../../store/slices/subjectEnrollmentSlice';
import api from '../../api/axios';
import './SubjectEnrollmentManager.css';

export default function SubjectEnrollmentManager() {
    const dispatch = useDispatch();
    const { list: years }    = useSelector((s) => s.academicYears);
    const { list: grades }   = useSelector((s) => s.grades);
    const { list: sections } = useSelector((s) => s.sections);
    const {
        pendingBuckets, pendingTotal, loading, error,
        studentEnrollments, studentMandatory, studentBuckets,
    } = useSelector((s) => s.subjectEnrollments);

    const [filterYear,    setFilterYear]    = useState('');
    const [filterGrade,   setFilterGrade]   = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [activeTab,     setActiveTab]     = useState('pending'); // 'pending' | 'student'

    const [searchStudent,   setSearchStudent]   = useState('');
    const [allStudents,     setAllStudents]     = useState([]);
    const [selectedStudent,  setSelectedStudent] = useState(null);
    const [bucketOptions,    setBucketOptions]   = useState({}); // { bucketName: [subjects] }
    const [assignError,      setAssignError]     = useState('');
    const [assigningBucket,  setAssigningBucket] = useState('');

    useEffect(() => { dispatch(fetchAcademicYears()); api.get('/users?role=student&limit=500').then(({ data }) => setAllStudents(data.users || [])); }, [dispatch]);
    useEffect(() => { if (filterYear) dispatch(fetchGrades({ academicYear: filterYear })); }, [dispatch, filterYear]);
    useEffect(() => { if (filterGrade) dispatch(fetchSections({ grade: filterGrade, academicYear: filterYear })); }, [dispatch, filterGrade, filterYear]);

    useEffect(() => {
        if (filterSection && filterYear) {
            dispatch(fetchPendingBuckets({ sectionId: filterSection, academicYearId: filterYear }));
        }
    }, [dispatch, filterSection, filterYear]);

    const openStudentTab = async (studentId) => {
        setSelectedStudent(allStudents.find((s) => s._id === studentId));
        setActiveTab('student');
        dispatch(clearSubjectEnrollmentError());
        await dispatch(fetchStudentSubjects({ studentId, academicYear: filterYear }));

        // Load available bucket options for this student's grade/section
        const section = sections.find((s) => s._id === filterSection);
        if (section) {
            try {
                const { data } = await api.get(`/subjects/buckets?grade=${section.grade?._id || section.grade}&academicYear=${filterYear}`);
                setBucketOptions(data.grouped || {});
            } catch { setBucketOptions({}); }
        }
    };

    const handleAssignBucket = async (subjectId, bucketName) => {
        if (!selectedStudent) return;
        setAssignError('');
        setAssigningBucket(bucketName);
        const result = await dispatch(assignBucketSubject({ studentId: selectedStudent._id, subjectId, academicYearId: filterYear }));
        setAssigningBucket('');
        if (result.error) { setAssignError(result.payload || 'Assignment failed'); return; }
        dispatch(fetchStudentSubjects({ studentId: selectedStudent._id, academicYear: filterYear }));
        if (filterSection) dispatch(fetchPendingBuckets({ sectionId: filterSection, academicYearId: filterYear }));
    };

    const handleChangeBucket = async (newSubjectId, bucketName) => {
        if (!selectedStudent) return;
        setAssignError('');
        setAssigningBucket(bucketName);
        const result = await dispatch(changeBucketSubject({ studentId: selectedStudent._id, newSubjectId, academicYearId: filterYear }));
        setAssigningBucket('');
        if (result.error) { setAssignError(result.payload || 'Change failed'); return; }
        dispatch(fetchStudentSubjects({ studentId: selectedStudent._id, academicYear: filterYear }));
    };

    const filteredGrades   = filterYear ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === filterYear) : grades;
    const filteredSections = filterGrade ? sections.filter((s) => (s.grade?._id || s.grade) === filterGrade) : sections;
    const filteredAllStudents = allStudents.filter((s) => s.name?.toLowerCase().includes(searchStudent.toLowerCase()) || s.email?.toLowerCase().includes(searchStudent.toLowerCase()));

    const currentBucketFor = (bucketName) => studentBuckets.find((e) => e.bucket === bucketName);

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Subject enrollment</h1>
                    <div className="topbar__right"><NotificationBell /></div>
                </div>

                <div className="page-body">
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                        <select className="form-input" style={{ width: 200 }} value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterGrade(''); setFilterSection(''); }}>
                            <option value="">Select academic year</option>
                            {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                        </select>
                        <select className="form-input" style={{ width: 220 }} value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterSection(''); }} disabled={!filterYear}>
                            <option value="">Select grade</option>
                            {filteredGrades.sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => <option key={g._id} value={g._id}>{g.name}{g.stream !== 'none' ? ` (${g.stream})` : ''}</option>)}
                        </select>
                        <select className="form-input" style={{ width: 160 }} value={filterSection} onChange={(e) => setFilterSection(e.target.value)} disabled={!filterGrade}>
                            <option value="">Select section</option>
                            {filteredSections.map((s) => <option key={s._id} value={s._id}>{s.grade?.gradeNumber}{s.name}</option>)}
                        </select>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                        <button className={`course-status-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                            Pending buckets {pendingTotal > 0 && <span className="badge badge-error" style={{ marginLeft: 6 }}>{pendingTotal}</span>}
                        </button>
                        <button className={`course-status-tab ${activeTab === 'student' ? 'active' : ''}`} onClick={() => setActiveTab('student')} disabled={!selectedStudent}>
                            Student view {selectedStudent ? `— ${selectedStudent.name}` : ''}
                        </button>
                    </div>

                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                    {!filterSection ? (
                        <div className="alert alert-info">Select academic year, grade, and section to see pending bucket selections.</div>
                    ) : activeTab === 'pending' ? (
                        loading ? (
                            <div className="empty-state"><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div>
                        ) : pendingBuckets.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">✅</div>
                                <p>All students in this section have completed their bucket selections (or no buckets are defined for this grade/stream).</p>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead><tr><th>Student</th><th>Roll no.</th><th>Missing buckets</th><th>Action</th></tr></thead>
                                    <tbody>
                                    {pendingBuckets.map((p) => (
                                        <tr key={p.student._id}>
                                            <td style={{ fontWeight: 500 }}>{p.student.name}</td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{p.rollNumber || '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {p.missingBuckets.map((b) => (
                                                        <span key={b} className="badge badge-error" style={{ fontSize: '0.7rem' }}>{b}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td><button className="btn btn-primary btn-sm" onClick={() => openStudentTab(p.student._id)}>Assign</button></td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : (
                        <div className="subject-enroll-grid">
                            {/* Student search panel */}
                            <div className="card">
                                <div className="card-header"><span className="card-title">Search student</span></div>
                                <input className="form-input" placeholder="Search by name or email…" value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} style={{ marginBottom: 'var(--space-md)' }} />
                                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {filteredAllStudents.slice(0, 50).map((s) => (
                                        <div
                                            key={s._id}
                                            onClick={() => openStudentTab(s._id)}
                                            style={{ padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: selectedStudent?._id === s._id ? 'var(--color-primary-light)' : 'transparent', fontSize: '0.875rem' }}
                                        >
                                            <div style={{ fontWeight: 500 }}>{s.name}</div>
                                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{s.email}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Student subject view */}
                            <div className="card">
                                {!selectedStudent ? (
                                    <div className="empty-state"><div className="empty-state__icon">👤</div><p>Select a student to view and assign subjects.</p></div>
                                ) : (
                                    <>
                                        <div className="card-header"><span className="card-title">{selectedStudent.name}'s subjects</span></div>

                                        {assignError && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{assignError}</div>}

                                        {/* Mandatory */}
                                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                                            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>MANDATORY</p>
                                            {studentMandatory.length === 0 ? (
                                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No mandatory subjects enrolled yet.</p>
                                            ) : (
                                                studentMandatory.map((e) => (
                                                    <div key={e._id} className="subject-enroll-row">
                                                        <span style={{ fontWeight: 500 }}>{e.subject?.name}</span>
                                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{e.subject?.code}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Buckets */}
                                        <div>
                                            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>ELECTIVE BUCKETS</p>
                                            {Object.keys(bucketOptions).length === 0 ? (
                                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No bucket subjects defined for this grade/stream.</p>
                                            ) : (
                                                Object.entries(bucketOptions).map(([bucketName, options]) => {
                                                    const current = currentBucketFor(bucketName);
                                                    return (
                                                        <div key={bucketName} className="bucket-card">
                                                            <div className="bucket-card__header">
                                                                <span className="bucket-card__name">{bucketName}</span>
                                                                {current && <span className="badge badge-success">{current.subject?.name}</span>}
                                                            </div>
                                                            <div className="bucket-card__options">
                                                                {options.map((opt) => {
                                                                    const isSelected = current?.subject?._id === opt._id;
                                                                    return (
                                                                        <button
                                                                            key={opt._id}
                                                                            className={`bucket-option-btn ${isSelected ? 'selected' : ''}`}
                                                                            disabled={assigningBucket === bucketName}
                                                                            onClick={() => current ? handleChangeBucket(opt._id, bucketName) : handleAssignBucket(opt._id, bucketName)}
                                                                        >
                                                                            {assigningBucket === bucketName ? <span className="spinner" /> : (
                                                                                <>
                                                                                    <span>{opt.name}</span>
                                                                                    {opt.teacher?.name && <span className="bucket-option-btn__teacher">{opt.teacher.name}</span>}
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}