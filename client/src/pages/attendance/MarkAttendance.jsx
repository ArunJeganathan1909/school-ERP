import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import {
    fetchEnrolledStudents,
    fetchSessionAttendance,
    markAttendance,
} from '../../store/slices/attendanceSlice';
import api from '../../api/axios';
import './MarkAttendance.css';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'];
const STATUS_COLORS = {
    present: { bg: '#ECFDF5', color: '#059669' },
    absent:  { bg: '#FEF2F2', color: '#DC2626' },
    late:    { bg: '#FFFBEB', color: '#D97706' },
    excused: { bg: '#EFF6FF', color: '#2563EB' },
};

export default function MarkAttendance() {
    const dispatch = useDispatch();
    const { user } = useSelector((s) => s.auth);
    const {
        enrolledStudents,
        sessionRecords,
        studentsLoading,
        loading,
        error,
    } = useSelector((s) => s.attendance);

    // My subjects (loaded once on mount)
    const [mySubjects, setMySubjects]           = useState([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);

    // Selections
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedCourse, setSelectedCourse]   = useState('');   // auto-filled
    const [selectedCourseName, setSelectedCourseName] = useState(''); // for display

    const [date, setDate]             = useState(new Date().toISOString().split('T')[0]);
    const [sessionType, setSessionType] = useState('lecture');
    const [attendance, setAttendance] = useState({});
    const [saving, setSaving]         = useState(false);
    const [saved, setSaved]           = useState(false);

    // ── Load teacher's own subjects on mount ──
    useEffect(() => {
        const teacherId = user?._id || user?.id;   // ← handles both shapes
        if (!teacherId) return;
        setSubjectsLoading(true);
        api.get(`/subjects?teacher=${teacherId}`)
            .then(({ data }) => setMySubjects(data.subjects || []))
            .catch(() => setMySubjects([]))
            .finally(() => setSubjectsLoading(false));
    }, [user?._id, user?.id]);   // ← watch both

    // ── When subject changes: auto-fill course, fetch students + existing records ──
    useEffect(() => {
        if (!selectedSubject) {
            setSelectedCourse('');
            setSelectedCourseName('');
            return;
        }

        // Find the subject object to get its course
        const subjectObj = mySubjects.find((s) => s._id === selectedSubject);
        if (subjectObj?.course) {
            const courseId   = subjectObj.course._id || subjectObj.course;
            const courseTitle = subjectObj.course.title || '';
            setSelectedCourse(courseId);
            setSelectedCourseName(courseTitle);
        }

        setSaved(false);
        dispatch(fetchEnrolledStudents({ subjectId: selectedSubject, date }));
        dispatch(fetchSessionAttendance({ subjectId: selectedSubject, date }));
    }, [dispatch, selectedSubject, mySubjects]);

    // ── When date changes (and subject already selected): re-fetch ──
    useEffect(() => {
        if (!selectedSubject) return;
        setSaved(false);
        dispatch(fetchEnrolledStudents({ subjectId: selectedSubject, date }));
        dispatch(fetchSessionAttendance({ subjectId: selectedSubject, date }));
    }, [dispatch, date]);

    // ── Initialise attendance map when student list changes ──
    useEffect(() => {
        const defaults = {};
        enrolledStudents.forEach((s) => { defaults[s._id] = 'present'; });
        setAttendance(defaults);
    }, [enrolledStudents]);

    // ── Overlay existing records on top of defaults ──
    useEffect(() => {
        if (!sessionRecords?.length) return;
        const existing = {};
        sessionRecords.forEach((r) => {
            existing[String(r.student._id ?? r.student)] = r.status;
        });
        setAttendance((prev) => ({ ...prev, ...existing }));
    }, [sessionRecords]);

    const handleSubjectChange = (subjectId) => {
        setSelectedSubject(subjectId);
    };

    const handleStatusChange = (studentId, status) =>
        setAttendance((prev) => ({ ...prev, [studentId]: status }));

    const markAll = (status) => {
        const all = {};
        enrolledStudents.forEach((s) => { all[s._id] = status; });
        setAttendance(all);
    };

    const handleSave = async () => {
        if (!selectedSubject || !selectedCourse || enrolledStudents.length === 0) return;
        setSaving(true);
        setSaved(false);

        const records = enrolledStudents.map((s) => ({
            studentId: s._id,
            status:    attendance[s._id] || 'present',
        }));

        const result = await dispatch(markAttendance({
            subjectId:   selectedSubject,
            courseId:    selectedCourse,
            date,
            sessionType,
            records,
        }));

        setSaving(false);
        if (markAttendance.fulfilled.match(result)) setSaved(true);
    };

    const counts = Object.values(attendance).reduce((acc, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    const isLoading = studentsLoading || loading;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Mark attendance</h1>
                    {enrolledStudents.length > 0 && (
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving
                                ? <><span className="spinner"></span> Saving…</>
                                : '✓ Save attendance'
                            }
                        </button>
                    )}
                </div>

                <div className="page-body">

                    {/* ── Controls ── */}
                    <div className="attendance-controls card">
                        <div className="attendance-controls__grid">

                            {/* Subject dropdown — primary selector */}
                            <div className="form-group">
                                <label className="form-label">Subject</label>
                                {subjectsLoading ? (
                                    <div className="form-input" style={{ color: 'var(--color-text-muted)' }}>
                                        Loading subjects…
                                    </div>
                                ) : (
                                    <select
                                        className="form-input"
                                        value={selectedSubject}
                                        onChange={(e) => handleSubjectChange(e.target.value)}
                                    >
                                        <option value="">Select subject</option>
                                        {mySubjects.map((s) => (
                                            <option key={s._id} value={s._id}>
                                                {s.name} ({s.code})
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {mySubjects.length === 0 && !subjectsLoading && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: 4 }}>
                                        No subjects assigned to you yet. Ask admin to assign subjects.
                                    </p>
                                )}
                            </div>

                            {/* Course — auto-filled, read-only */}
                            <div className="form-group">
                                <label className="form-label">Course</label>
                                <div
                                    className="form-input attendance-course-display"
                                    style={{
                                        background:   selectedCourse ? 'var(--color-primary-light)' : 'var(--color-bg)',
                                        color:        selectedCourse ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                        fontWeight:   selectedCourse ? 600 : 400,
                                        cursor:       'default',
                                        userSelect:   'none',
                                    }}
                                >
                                    {selectedCourseName || 'Auto-filled from subject'}
                                </div>
                            </div>

                            {/* Date */}
                            <div className="form-group">
                                <label className="form-label">Date</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            {/* Session type */}
                            <div className="form-group">
                                <label className="form-label">Session type</label>
                                <select
                                    className="form-input"
                                    value={sessionType}
                                    onChange={(e) => setSessionType(e.target.value)}
                                >
                                    {['lecture', 'lab', 'tutorial', 'exam'].map((t) => (
                                        <option key={t} value={t}>
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Subject info pill — shows which course this subject belongs to */}
                        {selectedSubject && selectedCourse && (
                            <div className="attendance-subject-info">
                                <span className="attendance-subject-info__icon">📚</span>
                                <span>
                                    Students shown are enrolled in{' '}
                                    <strong>{selectedCourseName}</strong>
                                    {' '}and attending{' '}
                                    <strong>
                                        {mySubjects.find(s => s._id === selectedSubject)?.name}
                                    </strong>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ── Summary bar ── */}
                    {enrolledStudents.length > 0 && (
                        <div className="attendance-summary">
                            {STATUS_OPTIONS.map((s) => (
                                <div
                                    key={s}
                                    className="attendance-summary__item"
                                    style={{
                                        background: STATUS_COLORS[s].bg,
                                        color:      STATUS_COLORS[s].color,
                                    }}
                                >
                                    <span className="attendance-summary__count">{counts[s] || 0}</span>
                                    <span className="attendance-summary__label">{s}</span>
                                </div>
                            ))}
                            <div className="attendance-summary__actions">
                                <span style={{
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-muted)',
                                    marginRight: 'var(--space-sm)',
                                }}>
                                    Mark all:
                                </span>
                                {STATUS_OPTIONS.map((s) => (
                                    <button
                                        key={s}
                                        className="btn btn-ghost btn-sm"
                                        style={{ color: STATUS_COLORS[s].color }}
                                        onClick={() => markAll(s)}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {saved && (
                        <div className="alert alert-success" style={{ marginBottom: 'var(--space-lg)' }}>
                            ✓ Attendance saved successfully for {enrolledStudents.length} students!
                        </div>
                    )}
                    {error && (
                        <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>
                            {error}
                        </div>
                    )}

                    {/* ── Student list ── */}
                    {!selectedSubject ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">✅</div>
                            <p>Select a subject to start marking attendance.</p>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                The course will be filled automatically.
                            </p>
                        </div>
                    ) : isLoading ? (
                        <div className="empty-state">
                            <div
                                className="spinner"
                                style={{
                                    borderColor:    'rgba(79,70,229,0.2)',
                                    borderTopColor: '#4F46E5',
                                    width: 32, height: 32, borderWidth: 3,
                                }}
                            />
                        </div>
                    ) : enrolledStudents.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">👥</div>
                            <p>No students enrolled in this course yet.</p>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th style={{ width: 48 }}>#</th>
                                    <th>Student</th>
                                    <th>Status</th>
                                </tr>
                                </thead>
                                <tbody>
                                {enrolledStudents.map((student, idx) => {
                                    const status = attendance[student._id] || 'present';
                                    const sc     = STATUS_COLORS[status];
                                    return (
                                        <tr key={student._id}>
                                            <td style={{ color: 'var(--color-text-muted)' }}>
                                                {idx + 1}
                                            </td>
                                            <td>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-sm)',
                                                }}>
                                                    <div style={{
                                                        width: 34, height: 34,
                                                        borderRadius: '50%',
                                                        background: 'var(--color-primary-light)',
                                                        color: 'var(--color-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 700,
                                                        fontSize: '0.875rem',
                                                        flexShrink: 0,
                                                    }}>
                                                        {student.name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{
                                                            fontWeight: 500,
                                                            fontSize: '0.9375rem',
                                                        }}>
                                                            {student.name}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.8125rem',
                                                            color: 'var(--color-text-muted)',
                                                        }}>
                                                            {student.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="attendance-status-row">
                                                    {STATUS_OPTIONS.map((s) => (
                                                        <button
                                                            key={s}
                                                            className={`attendance-status-btn ${status === s ? 'active' : ''}`}
                                                            style={status === s
                                                                ? { background: sc.bg, color: sc.color, borderColor: sc.color }
                                                                : {}
                                                            }
                                                            onClick={() => handleStatusChange(student._id, s)}
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
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
        </div>
    );
}