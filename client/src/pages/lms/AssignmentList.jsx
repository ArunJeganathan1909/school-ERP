import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssignment, submitAssignment } from '../../store/slices/assignmentSlice';
import { fetchMyEnrollments } from '../../store/slices/enrollmentSlice';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import api from '../../api/axios';
import './AssignmentList.css';

export default function AssignmentList() {
    const dispatch = useDispatch();

    const { current, currentSubmission, error } = useSelector((s) => s.assignments);
    const { list: enrollments, loading: enrollLoading } = useSelector((s) => s.enrollments);

    // Local assignment list (fetched directly, not via Redux slice)
    const [assignments,   setAssignments]   = useState([]);
    const [assLoading,    setAssLoading]    = useState(false);

    const [selected,      setSelected]      = useState(null);
    const [textAnswer,    setTextAnswer]    = useState('');
    const [submitting,    setSubmitting]    = useState(false);
    const [submitError,   setSubmitError]   = useState('');

    // Filter state
    const [statusFilter,  setStatusFilter]  = useState('all');  // all | open | overdue
    const [courseFilter,  setCourseFilter]  = useState('all');  // all | courseId

    /* ── Step 1: load enrollments ── */
    useEffect(() => {
        dispatch(fetchMyEnrollments());
    }, [dispatch]);

    /* ── Step 2: once enrollments load, fetch assignments for ALL courses ── */
    useEffect(() => {
        const activeEnrollments = enrollments.filter(e => e.status === 'active');
        if (activeEnrollments.length === 0) return;

        const courseIds = activeEnrollments
            .map(e => e.course?._id || e.course)
            .filter(Boolean);

        if (courseIds.length === 0) return;

        const loadAssignments = async () => {
            setAssLoading(true);
            try {
                const { data } = await api.get(
                    `/assignments/student/mine?courseIds=${courseIds.join(',')}`
                );
                setAssignments(data.assignments || []);
            } catch (err) {
                console.error('Failed to load assignments:', err);
                setAssignments([]);
            }
            setAssLoading(false);
        };

        loadAssignments();
    }, [enrollments]);

    /* ── Select an assignment ── */
    const handleSelect = (assignment) => {
        setSelected(assignment._id);
        setTextAnswer('');
        setSubmitError('');
        dispatch(fetchAssignment(assignment._id));
    };

    /* ── Submit answer ── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!textAnswer.trim()) return;
        setSubmitting(true);
        setSubmitError('');
        const result = await dispatch(
            submitAssignment({ assignmentId: selected, textAnswer })
        );
        if (submitAssignment.rejected.match(result)) {
            setSubmitError(result.payload || 'Submission failed. Please try again.');
        }
        setSubmitting(false);
    };

    /* ── Helpers ── */
    const isPast = (date) => new Date(date) < new Date();

    const statusLabel = (a) => {
        if (isPast(a.dueDate)) return { label: 'Overdue', color: '#DC2626', bg: '#FEF2F2' };
        const diff = Math.ceil((new Date(a.dueDate) - new Date()) / 86400000);
        if (diff === 0) return { label: 'Due today', color: '#DC2626', bg: '#FEF2F2' };
        if (diff <= 3)  return { label: `Due in ${diff}d`, color: '#D97706', bg: '#FFFBEB' };
        return { label: 'Open', color: '#059669', bg: '#ECFDF5' };
    };

    /* ── Build unique course list for filter tabs ── */
    const enrolledCourses = enrollments
        .filter(e => e.status === 'active' && e.course)
        .map(e => ({ _id: e.course?._id || e.course, title: e.course?.title || e.course?.code || 'Course' }))
        .filter((c, i, arr) => arr.findIndex(x => String(x._id) === String(c._id)) === i);

    /* ── Apply filters ── */
    const filtered = assignments.filter(a => {
        // Course filter
        if (courseFilter !== 'all' && String(a.course?._id || a.course) !== String(courseFilter)) {
            return false;
        }
        // Status filter
        if (statusFilter === 'open'    && isPast(a.dueDate))  return false;
        if (statusFilter === 'overdue' && !isPast(a.dueDate)) return false;
        return true;
    });

    /* ── Counts for filter badges ── */
    const counts = {
        all:     assignments.length,
        open:    assignments.filter(a => !isPast(a.dueDate)).length,
        overdue: assignments.filter(a =>  isPast(a.dueDate)).length,
    };

    const isLoading = enrollLoading || assLoading;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">

                <div className="topbar">
                    <h1 className="topbar__title">Assignments</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        {assignments.length > 0 && (
                            <span style={{
                                fontSize: '0.8125rem',
                                color: 'var(--color-text-muted)',
                            }}>
                                {filtered.length} of {assignments.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Filter bar (course tabs + status tabs) ── */}
                {assignments.length > 0 && (
                    <div className="assignment-filter-bar">

                        {/* Status filter */}
                        <div className="assignment-filter-group">
                            {[
                                { key: 'all',     label: `All (${counts.all})`         },
                                { key: 'open',    label: `Open (${counts.open})`        },
                                { key: 'overdue', label: `Overdue (${counts.overdue})`  },
                            ].map(({ key, label }) => (
                                <button
                                    key={key}
                                    className={`assignment-filter-btn ${statusFilter === key ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Course filter (only if enrolled in 2+ courses) */}
                        {enrolledCourses.length > 1 && (
                            <div className="assignment-filter-group">
                                <button
                                    className={`assignment-filter-btn ${courseFilter === 'all' ? 'active' : ''}`}
                                    onClick={() => setCourseFilter('all')}
                                >
                                    All courses
                                </button>
                                {enrolledCourses.map((c) => (
                                    <button
                                        key={c._id}
                                        className={`assignment-filter-btn ${courseFilter === String(c._id) ? 'active' : ''}`}
                                        onClick={() => setCourseFilter(String(c._id))}
                                    >
                                        {c.title}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="assignment-layout">

                    {/* ── Left pane: assignment list ── */}
                    <div className="assignment-list-pane">

                        {isLoading ? (
                            <div className="empty-state">
                                <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                <p style={{ marginTop: 'var(--space-sm)', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                    Loading assignments…
                                </p>
                            </div>

                        ) : enrollments.filter(e => e.status === 'active').length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">📚</div>
                                <p>You are not enrolled in any courses.</p>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                    Enroll in a course to see assignments.
                                </p>
                            </div>

                        ) : assignments.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">📝</div>
                                <p>No assignments yet.</p>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                    Your teachers haven't posted any assignments yet.
                                </p>
                            </div>

                        ) : filtered.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">🔍</div>
                                <p>No assignments match this filter.</p>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ marginTop: 'var(--space-sm)' }}
                                    onClick={() => { setStatusFilter('all'); setCourseFilter('all'); }}
                                >
                                    Clear filters
                                </button>
                            </div>

                        ) : filtered.map((a) => {
                            const st = statusLabel(a);
                            return (
                                <div
                                    key={a._id}
                                    className={`assignment-item ${selected === a._id ? 'active' : ''}`}
                                    onClick={() => handleSelect(a)}
                                >
                                    <div className="assignment-item__top">
                                        <span className="assignment-item__subject">
                                            {a.subject?.name || a.course?.code || '—'}
                                        </span>
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-full)',
                                            background: st.bg, color: st.color,
                                        }}>
                                            {st.label}
                                        </span>
                                    </div>

                                    <div className="assignment-item__title">{a.title}</div>

                                    <div className="assignment-item__meta">
                                        {/* Course name */}
                                        <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                                            {a.course?.title || a.course?.code || ''}
                                        </span>
                                    </div>

                                    <div className="assignment-item__meta">
                                        📅 {new Date(a.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'short', year: 'numeric',
                                    })} · 🎯 {a.totalMarks} marks
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Right pane: assignment detail ── */}
                    <div className="assignment-detail-pane">

                        {!selected ? (
                            <div className="empty-state" style={{ height: '100%' }}>
                                <div className="empty-state__icon">📋</div>
                                <p>Select an assignment to view details.</p>
                            </div>

                        ) : !current ? (
                            <div className="empty-state" style={{ height: '100%' }}>
                                <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                            </div>

                        ) : (
                            <div className="assignment-detail">

                                {/* Header */}
                                <h2 className="assignment-detail__title">{current.title}</h2>

                                <div className="assignment-detail__meta">
                                    {current.subject?.name && (
                                        <span>📖 {current.subject.name} ({current.subject.code})</span>
                                    )}
                                    {current.course?.title && (
                                        <span>📚 {current.course.title}</span>
                                    )}
                                    <span>📅 Due: {new Date(current.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}</span>
                                    <span>🎯 {current.totalMarks} marks</span>
                                    <span>✅ Pass: {current.passingMarks}</span>
                                    {current.allowLateSubmission && (
                                        <span style={{ color: '#059669' }}>🕐 Late submissions allowed</span>
                                    )}
                                </div>

                                {/* Overdue warning */}
                                {isPast(current.dueDate) && !currentSubmission && (
                                    <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>
                                        ⚠ This assignment is past its due date.
                                        {current.allowLateSubmission
                                            ? ' Late submissions are accepted.'
                                            : ' Submissions are no longer accepted.'}
                                    </div>
                                )}

                                {current.description && (
                                    <div className="assignment-detail__desc">{current.description}</div>
                                )}

                                {current.instructions && (
                                    <div className="assignment-detail__instructions">
                                        <strong>Instructions:</strong>
                                        <p style={{ marginTop: 'var(--space-xs)' }}>{current.instructions}</p>
                                    </div>
                                )}

                                {/* ── Attachment download ── */}
                                {current.attachmentUrl && current.attachmentUrl.trim() !== '' && (
                                    <div className="assignment-attachment">
                                        <div className="assignment-attachment__icon">
                                            {current.attachmentUrl.endsWith('.pdf')  ? '📄' :
                                                current.attachmentUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? '🖼' :
                                                    current.attachmentUrl.match(/\.(doc|docx)$/i) ? '📝' :
                                                        current.attachmentUrl.match(/\.(ppt|pptx)$/i) ? '📊' :
                                                            current.attachmentUrl.match(/\.(xls|xlsx)$/i) ? '📈' :
                                                                current.attachmentUrl.match(/\.zip$/i)        ? '🗜' :
                                                                    '📎'}
                                        </div>
                                        <div className="assignment-attachment__info">
            <span className="assignment-attachment__label">
                📎 Attachment from teacher
            </span>
                                            <span className="assignment-attachment__name">
                {(() => {
                    try {
                        const raw = current.attachmentUrl.split('/').pop();
                        return decodeURIComponent(raw.replace(/^\d+-/, ''));
                    } catch {
                        return current.attachmentUrl.split('/').pop();
                    }
                })()}
            </span>
                                        </div>
                                    <a
                                        href={current.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary btn-sm"
                                        download
                                        >
                                        ⬇ Download
                                    </a>
                                    </div>
                                    )}

                                <hr className="divider" />

                                {/* ── Submission section ── */}
                                {currentSubmission ? (
                                    /* Already submitted */
                                    <div className="submission-result">
                                        <div className="submission-result__header">
                                            <span>Your submission</span>
                                            <span className={`badge ${
                                                currentSubmission.status === 'graded'   ? 'badge-success' :
                                                    currentSubmission.status === 'returned' ? 'badge-error'   :
                                                        'badge-student'
                                            }`}>
                                                {currentSubmission.status}
                                            </span>
                                        </div>

                                        {currentSubmission.isLate && (
                                            <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
                                                🕐 Submitted late
                                            </div>
                                        )}

                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                                            Submitted: {new Date(currentSubmission.submittedAt).toLocaleDateString('en-GB', {
                                            day: 'numeric', month: 'long', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                        </div>

                                        {currentSubmission.textAnswer && (
                                            <div className="submission-result__answer">
                                                <strong>Your answer:</strong>
                                                <p style={{ marginTop: 'var(--space-xs)', whiteSpace: 'pre-wrap' }}>
                                                    {currentSubmission.textAnswer}
                                                </p>
                                            </div>
                                        )}

                                        {currentSubmission.status === 'graded' && (
                                            <div className="submission-result__grade">
                                                <div className="grade-score">
                                                    <span className="grade-score__value">{currentSubmission.marks}</span>
                                                    <span className="grade-score__total">/ {current.totalMarks}</span>
                                                    <span style={{
                                                        marginLeft: 'var(--space-sm)',
                                                        fontSize: '0.875rem',
                                                        color: currentSubmission.marks >= current.passingMarks ? '#059669' : '#DC2626',
                                                        fontWeight: 600,
                                                    }}>
                                                        ({Math.round((currentSubmission.marks / current.totalMarks) * 100)}%)
                                                        — {currentSubmission.marks >= current.passingMarks ? 'Pass' : 'Fail'}
                                                    </span>
                                                </div>

                                                {currentSubmission.feedback && (
                                                    <div className="submission-result__feedback">
                                                        <strong>Teacher feedback:</strong>
                                                        <p style={{ marginTop: 'var(--space-xs)', whiteSpace: 'pre-wrap' }}>
                                                            {currentSubmission.feedback}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                ) : isPast(current.dueDate) && !current.allowLateSubmission ? (
                                    /* Past due, no late allowed */
                                    <div className="empty-state" style={{ paddingTop: 'var(--space-lg)' }}>
                                        <div className="empty-state__icon">🔒</div>
                                        <p style={{ fontWeight: 600 }}>Submissions closed</p>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                            The deadline has passed and late submissions are not allowed.
                                        </p>
                                    </div>

                                ) : (
                                    /* Submit form */
                                    <div className="submission-form">
                                        <h3 className="submission-form__title">
                                            Submit your answer
                                            {isPast(current.dueDate) && (
                                                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#D97706', fontWeight: 400 }}>
                                                    (late submission)
                                                </span>
                                            )}
                                        </h3>

                                        {submitError && (
                                            <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                                                {submitError}
                                            </div>
                                        )}

                                        <form onSubmit={handleSubmit}>
                                            <div className="form-group">
                                                <label className="form-label">Your answer</label>
                                                <textarea
                                                    className="form-input"
                                                    rows={8}
                                                    value={textAnswer}
                                                    onChange={(e) => setTextAnswer(e.target.value)}
                                                    placeholder="Type your answer here… Be thorough and clear."
                                                    required
                                                    style={{ resize: 'vertical' }}
                                                />
                                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                    {textAnswer.length} characters
                                                </p>
                                            </div>
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={submitting || !textAnswer.trim()}
                                            >
                                                {submitting
                                                    ? <><span className="spinner"></span> Submitting…</>
                                                    : 'Submit assignment'
                                                }
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}