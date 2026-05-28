import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import { fetchSessionAttendance, markAttendance } from '../../store/slices/attendanceSlice';
import { fetchCourses } from '../../store/slices/courseSlice';
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
    const { sessionRecords, loading, error } = useSelector((s) => s.attendance);
    const { list: courses } = useSelector((s) => s.courses);

    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionType, setSessionType] = useState('lecture');
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        dispatch(fetchCourses({ limit: 100 }));
    }, [dispatch]);

    // Load subjects when course changes
    useEffect(() => {
        if (!selectedCourse) { setSubjects([]); setSelectedSubject(''); return; }
        api.get(`/subjects?course=${selectedCourse}`)
            .then(({ data }) => setSubjects(data.subjects || []))
            .catch(() => setSubjects([]));
    }, [selectedCourse]);

    // Load enrolled students + existing records when subject/date changes
    useEffect(() => {
        if (!selectedSubject || !selectedCourse || !date) return;

        // Get enrolled students
        api.get(`/enrollments/course/${selectedCourse}?status=active`)
            .then(({ data }) => {
                const list = data.enrollments.map((e) => e.student);
                setStudents(list);

                // Default all to present
                const defaults = {};
                list.forEach((s) => { defaults[s._id] = 'present'; });
                setAttendance(defaults);
            });

        // Load existing session records
        dispatch(fetchSessionAttendance({ subjectId: selectedSubject, date }));
    }, [dispatch, selectedSubject, selectedCourse, date]);

    // Overlay existing records
    useEffect(() => {
        if (sessionRecords.length === 0) return;
        const existing = {};
        sessionRecords.forEach((r) => { existing[String(r.student._id)] = r.status; });
        setAttendance((prev) => ({ ...prev, ...existing }));
    }, [sessionRecords]);

    const handleStatusChange = (studentId, status) => {
        setAttendance((prev) => ({ ...prev, [studentId]: status }));
    };

    const markAll = (status) => {
        const all = {};
        students.forEach((s) => { all[s._id] = status; });
        setAttendance(all);
    };

    const handleSave = async () => {
        if (!selectedSubject || students.length === 0) return;
        setSaving(true);
        setSaved(false);

        const records = students.map((s) => ({
            studentId: s._id,
            status: attendance[s._id] || 'present',
        }));

        const result = await dispatch(markAttendance({
            subjectId: selectedSubject,
            courseId: selectedCourse,
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

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Mark attendance</h1>
                    {students.length > 0 && (
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <><span className="spinner"></span> Saving…</> : '✓ Save attendance'}
                        </button>
                    )}
                </div>

                <div className="page-body">
                    {/* Controls */}
                    <div className="attendance-controls card">
                        <div className="attendance-controls__grid">
                            <div className="form-group">
                                <label className="form-label">Course</label>
                                <select className="form-input" value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
                                    <option value="">Select course</option>
                                    {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subject</label>
                                <select className="form-input" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!selectedCourse}>
                                    <option value="">Select subject</option>
                                    {subjects.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date</label>
                                <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Session type</label>
                                <select className="form-input" value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
                                    {['lecture', 'lab', 'tutorial', 'exam'].map((t) => (
                                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Summary bar */}
                    {students.length > 0 && (
                        <div className="attendance-summary">
                            {STATUS_OPTIONS.map((s) => (
                                <div key={s} className="attendance-summary__item" style={{ background: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].color }}>
                                    <span className="attendance-summary__count">{counts[s] || 0}</span>
                                    <span className="attendance-summary__label">{s}</span>
                                </div>
                            ))}
                            <div className="attendance-summary__actions">
                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginRight: 'var(--space-sm)' }}>Mark all:</span>
                                {STATUS_OPTIONS.map((s) => (
                                    <button key={s} className="btn btn-ghost btn-sm" style={{ color: STATUS_COLORS[s].color }} onClick={() => markAll(s)}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {saved && <div className="alert alert-success" style={{ marginBottom: 'var(--space-lg)' }}>✓ Attendance saved successfully!</div>}
                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                    {/* Student list */}
                    {!selectedSubject ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">✅</div>
                            <p>Select a course and subject to start marking attendance.</p>
                        </div>
                    ) : loading ? (
                        <div className="empty-state"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div></div>
                    ) : students.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">👥</div>
                            <p>No students enrolled in this course yet.</p>
                        </div>
                    ) : (
                        <div className="attendance-table card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Student</th>
                                    <th>Status</th>
                                </tr>
                                </thead>
                                <tbody>
                                {students.map((student, idx) => {
                                    const status = attendance[student._id] || 'present';
                                    const sc = STATUS_COLORS[status];
                                    return (
                                        <tr key={student._id}>
                                            <td style={{ color: 'var(--color-text-muted)', width: 48 }}>{idx + 1}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}>
                                                        {student.name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{student.name}</div>
                                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{student.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="attendance-status-row">
                                                    {STATUS_OPTIONS.map((s) => (
                                                        <button
                                                            key={s}
                                                            className={`attendance-status-btn ${status === s ? 'active' : ''}`}
                                                            style={status === s ? { background: sc.bg, color: sc.color, borderColor: sc.color } : {}}
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