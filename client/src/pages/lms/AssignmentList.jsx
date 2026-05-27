import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchAssignments, fetchAssignment, submitAssignment } from '../../store/slices/assignmentSlice';
import Sidebar from '../../components/Sidebar';
import './AssignmentList.css';

export default function AssignmentList() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { list: assignments, current, currentSubmission, loading, error } = useSelector((s) => s.assignments);
    const { list: enrollments } = useSelector((s) => s.enrollments);
    const [selected, setSelected] = useState(null);
    const [textAnswer, setTextAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Get all enrolled course IDs
    const courseIds = enrollments.filter(e => e.status === 'active').map(e => e.course?._id).filter(Boolean);

    useEffect(() => {
        // Fetch assignments for first enrolled course — in production fetch all
        if (courseIds.length > 0) {
            dispatch(fetchAssignments({ course: courseIds[0] }));
        }
    }, [dispatch, courseIds.length]);

    const handleSelect = (assignment) => {
        setSelected(assignment._id);
        setTextAnswer('');
        dispatch(fetchAssignment(assignment._id));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!textAnswer.trim()) return;
        setSubmitting(true);
        await dispatch(submitAssignment({ assignmentId: selected, textAnswer }));
        setSubmitting(false);
    };

    const isPast = (date) => new Date(date) < new Date();

    const statusLabel = (a) => {
        if (isPast(a.dueDate)) return { label: 'Overdue', color: '#DC2626', bg: '#FEF2F2' };
        const diff = Math.ceil((new Date(a.dueDate) - new Date()) / 86400000);
        if (diff <= 3) return { label: `Due in ${diff}d`, color: '#D97706', bg: '#FFFBEB' };
        return { label: 'Open', color: '#059669', bg: '#ECFDF5' };
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Assignments</h1>
                </div>

                <div className="assignment-layout">
                    {/* List pane */}
                    <div className="assignment-list-pane">
                        {loading ? (
                            <div className="empty-state"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div></div>
                        ) : assignments.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">📝</div>
                                <p>No assignments yet.</p>
                            </div>
                        ) : assignments.map((a) => {
                            const st = statusLabel(a);
                            return (
                                <div
                                    key={a._id}
                                    className={`assignment-item ${selected === a._id ? 'active' : ''}`}
                                    onClick={() => handleSelect(a)}
                                >
                                    <div className="assignment-item__top">
                                        <span className="assignment-item__subject">{a.subject?.name}</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: st.bg, color: st.color }}>{st.label}</span>
                                    </div>
                                    <div className="assignment-item__title">{a.title}</div>
                                    <div className="assignment-item__meta">
                                        {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {a.totalMarks} marks
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detail pane */}
                    <div className="assignment-detail-pane">
                        {!selected ? (
                            <div className="empty-state" style={{ height: '100%' }}>
                                <div className="empty-state__icon">📋</div>
                                <p>Select an assignment to view details.</p>
                            </div>
                        ) : current ? (
                            <div className="assignment-detail">
                                <h2 className="assignment-detail__title">{current.title}</h2>
                                <div className="assignment-detail__meta">
                                    <span>📚 {current.subject?.name}</span>
                                    <span>📅 Due: {new Date(current.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    <span>🎯 {current.totalMarks} marks</span>
                                    <span>✅ Pass: {current.passingMarks}</span>
                                </div>

                                {current.description && (
                                    <div className="assignment-detail__desc">{current.description}</div>
                                )}

                                {current.instructions && (
                                    <div className="assignment-detail__instructions">
                                        <strong>Instructions:</strong>
                                        <p>{current.instructions}</p>
                                    </div>
                                )}

                                <hr className="divider" />

                                {/* Submission section */}
                                {currentSubmission ? (
                                    <div className="submission-result">
                                        <div className="submission-result__header">
                                            <span>Submission status</span>
                                            <span className={`badge ${currentSubmission.status === 'graded' ? 'badge-success' : 'badge-student'}`}>
                        {currentSubmission.status}
                      </span>
                                        </div>
                                        {currentSubmission.isLate && <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>Submitted late</div>}
                                        {currentSubmission.textAnswer && (
                                            <div className="submission-result__answer">
                                                <strong>Your answer:</strong>
                                                <p>{currentSubmission.textAnswer}</p>
                                            </div>
                                        )}
                                        {currentSubmission.status === 'graded' && (
                                            <div className="submission-result__grade">
                                                <div className="grade-score">
                                                    <span className="grade-score__value">{currentSubmission.marks}</span>
                                                    <span className="grade-score__total">/ {current.totalMarks}</span>
                                                </div>
                                                {currentSubmission.feedback && (
                                                    <div className="submission-result__feedback">
                                                        <strong>Teacher feedback:</strong>
                                                        <p>{currentSubmission.feedback}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="submission-form">
                                        <h3 className="submission-form__title">Submit your answer</h3>
                                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}
                                        <form onSubmit={handleSubmit}>
                                            <div className="form-group">
                                                <label className="form-label">Your answer</label>
                                                <textarea
                                                    className="form-input"
                                                    rows={6}
                                                    value={textAnswer}
                                                    onChange={(e) => setTextAnswer(e.target.value)}
                                                    placeholder="Type your answer here…"
                                                    required
                                                    style={{ resize: 'vertical' }}
                                                />
                                            </div>
                                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                                {submitting ? <><span className="spinner"></span> Submitting…</> : 'Submit assignment'}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}