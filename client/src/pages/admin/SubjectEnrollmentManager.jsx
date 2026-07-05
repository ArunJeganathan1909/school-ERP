import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchAcademicYears } from '../../store/slices/academicYearSlice';
import { fetchGrades } from '../../store/slices/gradeSlice';
import { fetchSections } from '../../store/slices/sectionSlice';
import {
    fetchStudentSubjects, assignBucketSubject, changeBucketSubject,
    clearSubjectEnrollmentError, clearStudentEnrollments,
} from '../../store/slices/subjectEnrollmentSlice';
import api from '../../api/axios';
import './SubjectEnrollmentManager.css';

export default function SubjectEnrollmentManager() {
    const dispatch = useDispatch();
    const { list: years }    = useSelector((s) => s.academicYears);
    const { list: grades }   = useSelector((s) => s.grades);
    const { list: sections } = useSelector((s) => s.sections);
    const {
        studentMandatory, studentBuckets, loading: enrollLoading, error,
    } = useSelector((s) => s.subjectEnrollments);

    // ── Step 1: Grade selection ──
    const [filterYear,  setFilterYear]  = useState('');
    const [filterGrade, setFilterGrade] = useState('');

    // ── Step 2: Section selection ──
    const [filterSection, setFilterSection] = useState('');

    // ── Step 3: Student list for the section ──
    const [sectionStudents, setSectionStudents] = useState([]);
    const [studentsLoading, setStudentsLoading] = useState(false);

    // ── Step 4: Selected student + their bucket options ──
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [bucketGrouped,   setBucketGrouped]   = useState({}); // { bucketName: [subjects] }
    const [bucketsLoading,  setBucketsLoading]  = useState(false);
    const [assigningBucket, setAssigningBucket] = useState(''); // which bucket name is currently saving

    useEffect(() => { dispatch(fetchAcademicYears()); }, [dispatch]);
    useEffect(() => { if (filterYear) dispatch(fetchGrades({ academicYear: filterYear })); }, [dispatch, filterYear]);
    useEffect(() => {
        if (filterGrade && filterYear) dispatch(fetchSections({ grade: filterGrade, academicYear: filterYear }));
    }, [dispatch, filterGrade, filterYear]);

    // Load students whenever a section is picked
    useEffect(() => {
        if (!filterSection) { setSectionStudents([]); return; }
        loadSectionStudents(filterSection);
    }, [filterSection]);

    // Load bucket options whenever the section's grade is known (re-used for every student in that section)
    useEffect(() => {
        const section = sections.find((s) => s._id === filterSection);
        if (!section) { setBucketGrouped({}); return; }
        loadBucketOptions(section);
    }, [filterSection, sections]);

    const loadSectionStudents = async (sectionId) => {
        setStudentsLoading(true);
        try {
            const { data } = await api.get(`/sections/${sectionId}/students`);
            setSectionStudents(data.students || []);
        } catch {
            setSectionStudents([]);
        }
        setStudentsLoading(false);
    };

    // Fetches only the bucket subjects relevant to this section's grade range
    // (or specific grade, for A/L) — uses the existing /subjects/buckets endpoint
    // which groups results by bucket name server-side.
    const loadBucketOptions = async (section) => {
        setBucketsLoading(true);
        try {
            const params = new URLSearchParams();
            const gradeNumber = section.grade?.gradeNumber;

            // Resolve the grade range client-side (mirrors gradeRangeFor on backend)
            let range = null;
            if (gradeNumber >= 1  && gradeNumber <= 5)  range = '1-5';
            if (gradeNumber >= 6  && gradeNumber <= 9)  range = '6-9';
            if (gradeNumber >= 10 && gradeNumber <= 11) range = '10-11';
            if (gradeNumber >= 12 && gradeNumber <= 13) range = '12-13';

            if (range) params.append('gradeRange', range);

            // A/L sections also need the specific grade+year match (Mode B subjects)
            if (gradeNumber >= 12) {
                params.append('grade', section.grade._id);
                params.append('academicYear', section.academicYear?._id || filterYear);
            }

            const { data } = await api.get(`/subjects/buckets?${params}`);
            setBucketGrouped(data.grouped || {});
        } catch {
            setBucketGrouped({});
        }
        setBucketsLoading(false);
    };

    const openStudent = (student) => {
        setSelectedStudent(student);
        dispatch(clearSubjectEnrollmentError());
        dispatch(fetchStudentSubjects({ studentId: student._id, academicYear: filterYear }));
    };

    const closeStudent = () => {
        setSelectedStudent(null);
        dispatch(clearStudentEnrollments());
    };

    const currentChoiceFor = (bucketName) =>
        studentBuckets.find((e) => e.bucket === bucketName);

    const handlePick = async (bucketName, subjectId) => {
        if (!selectedStudent) return;
        setAssigningBucket(bucketName);

        const existing = currentChoiceFor(bucketName);
        const result = existing
            ? await dispatch(changeBucketSubject({ studentId: selectedStudent._id, newSubjectId: subjectId, academicYearId: filterYear }))
            : await dispatch(assignBucketSubject({ studentId: selectedStudent._id, subjectId, academicYearId: filterYear }));

        setAssigningBucket('');
        if (!result.error) {
            // Refresh this student's view so the "current pick" badge updates
            dispatch(fetchStudentSubjects({ studentId: selectedStudent._id, academicYear: filterYear }));
        }
    };

    const filteredGrades   = filterYear  ? grades.filter((g) => (g.academicYear?._id || g.academicYear) === filterYear) : [];
    const filteredSections = filterGrade ? sections.filter((s) => (s.grade?._id || s.grade) === filterGrade) : [];
    const selectedSection  = sections.find((s) => s._id === filterSection);

    const bucketNames = Object.keys(bucketGrouped);

    // Which buckets has this student already filled?
    const filledBucketNames = new Set(studentBuckets.map((e) => e.bucket));
    const missingCount = bucketNames.filter((b) => !filledBucketNames.has(b)).length;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Subject enrollment — Electives</h1>
                    <div className="topbar__right"><NotificationBell /></div>
                </div>

                <div className="page-body">

                    {/* ── Step 1 & 2: Grade + Section picker ── */}
                    <div className="sem-steps">
                        <div className="sem-step">
                            <span className="sem-step__num">1</span>
                            <select className="form-input" value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterGrade(''); setFilterSection(''); setSelectedStudent(null); }}>
                                <option value="">Select academic year</option>
                                {years.map((y) => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' ✓' : ''}</option>)}
                            </select>
                        </div>

                        <div className="sem-step">
                            <span className="sem-step__num">2</span>
                            <select className="form-input" value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterSection(''); setSelectedStudent(null); }} disabled={!filterYear}>
                                <option value="">Select grade</option>
                                {filteredGrades.sort((a, b) => a.gradeNumber - b.gradeNumber).map((g) => (
                                    <option key={g._id} value={g._id}>{g.name}{g.stream !== 'none' ? ` (${g.stream})` : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div className="sem-step">
                            <span className="sem-step__num">3</span>
                            <select className="form-input" value={filterSection} onChange={(e) => { setFilterSection(e.target.value); setSelectedStudent(null); }} disabled={!filterGrade}>
                                <option value="">Select section</option>
                                {filteredSections.map((s) => <option key={s._id} value={s._id}>{s.grade?.gradeNumber}{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {!filterSection ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">🪣</div>
                            <p>Select an academic year, grade, and section to begin assigning elective subjects.</p>
                        </div>
                    ) : (
                        <div className="sem-layout">

                            {/* ── Step 3: Student list ── */}
                            <div className="card">
                                <div className="card-header">
                                    <span className="card-title">Students in {selectedSection?.grade?.gradeNumber}{selectedSection?.name}</span>
                                    {bucketNames.length > 0 && (
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      {bucketNames.length} bucket{bucketNames.length !== 1 ? 's' : ''} available
                    </span>
                                    )}
                                </div>

                                {studentsLoading ? (
                                    <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                    </div>
                                ) : sectionStudents.length === 0 ? (
                                    <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                        <div className="empty-state__icon">👥</div>
                                        <p>No students assigned to this section yet.</p>
                                    </div>
                                ) : (
                                    <div className="sem-student-list">
                                        {sectionStudents.map((record) => {
                                            const isSelected = selectedStudent?._id === record.student?._id;
                                            return (
                                                <div
                                                    key={record._id}
                                                    className={`sem-student-row ${isSelected ? 'sem-student-row--active' : ''}`}
                                                    onClick={() => openStudent(record.student)}
                                                >
                                                    <div className="sem-student-row__avatar">{record.student?.name?.charAt(0).toUpperCase()}</div>
                                                    <div className="sem-student-row__info">
                                                        <div className="sem-student-row__name">{record.student?.name}</div>
                                                        <div className="sem-student-row__email">{record.student?.email}</div>
                                                    </div>
                                                    {record.rollNumber && <span className="sem-student-row__roll">{record.rollNumber}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* ── Step 4: Bucket assignment panel for selected student ── */}
                            <div className="card">
                                {!selectedStudent ? (
                                    <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                        <div className="empty-state__icon">👈</div>
                                        <p>Select a student from the list to assign their elective subjects.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="card-header">
                                            <span className="card-title">{selectedStudent.name}'s electives</span>
                                            <button className="btn btn-ghost btn-sm" onClick={closeStudent}>✕</button>
                                        </div>

                                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

                                        {/* Mandatory subjects (read-only reference) */}
                                        {studentMandatory.length > 0 && (
                                            <div style={{ marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-lg)', borderBottom: '1px solid var(--color-border)' }}>
                                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)' }}>
                                                    📌 Mandatory subjects ({studentMandatory.length})
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {studentMandatory.map((e) => (
                                                        <span key={e._id} className="badge badge-student" style={{ textTransform: 'none' }}>{e.subject?.name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Bucket choices */}
                                        {bucketsLoading || enrollLoading ? (
                                            <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                            </div>
                                        ) : bucketNames.length === 0 ? (
                                            <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                                <div className="empty-state__icon">🪣</div>
                                                <p>No elective buckets defined for this grade range yet. Create bucket subjects under Subjects management first.</p>
                                            </div>
                                        ) : (
                                            <>
                                                {missingCount > 0 && (
                                                    <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
                                                        ⚠ {missingCount} bucket{missingCount !== 1 ? 's' : ''} still need a selection.
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                                    {bucketNames.map((bucketName) => {
                                                        const options = bucketGrouped[bucketName];
                                                        const current = currentChoiceFor(bucketName);
                                                        return (
                                                            <div key={bucketName} className="sem-bucket-card">
                                                                <div className="sem-bucket-card__header">
                                                                    <span className="sem-bucket-card__name">🪣 {bucketName}</span>
                                                                    {current ? (
                                                                        <span className="badge badge-success">{current.subject?.name}</span>
                                                                    ) : (
                                                                        <span className="badge badge-error">Not chosen</span>
                                                                    )}
                                                                </div>
                                                                <div className="sem-bucket-card__options">
                                                                    {options.map((opt) => {
                                                                        const isPicked = current?.subject?._id === opt._id;
                                                                        const isSaving = assigningBucket === bucketName;
                                                                        return (
                                                                            <button
                                                                                key={opt._id}
                                                                                className={`sem-bucket-option ${isPicked ? 'sem-bucket-option--picked' : ''}`}
                                                                                disabled={isSaving || isPicked}
                                                                                onClick={() => handlePick(bucketName, opt._id)}
                                                                            >
                                                                                {isSaving && !isPicked ? (
                                                                                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                                                                ) : (
                                                                                    <>
                                                                                        <span>{opt.name}</span>
                                                                                        <span className="sem-bucket-option__code">{opt.code}</span>
                                                                                    </>
                                                                                )}
                                                                                {isPicked && <span className="sem-bucket-option__check">✓</span>}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
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