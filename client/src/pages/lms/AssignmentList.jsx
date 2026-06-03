import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssignment, submitAssignment } from '../../store/slices/assignmentSlice';
import { fetchMyEnrollments } from '../../store/slices/enrollmentSlice';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import './AssignmentList.css';

const FILE_ICONS = {
    pdf: '📄', doc: '📝', docx: '📝',
    ppt: '📊', pptx: '📊',
    xls: '📉', xlsx: '📉',
    png: '🖼', jpg: '🖼', jpeg: '🖼',
    zip: '🗜', txt: '📃',
};

const getFileIcon = (url = '') => {
    const ext = (url.split('.').pop() || '').toLowerCase().split('?')[0];
    return FILE_ICONS[ext] || '📎';
};

export default function AssignmentList() {
    const dispatch = useDispatch();

    const { current, currentSubmission, error } = useSelector((s) => s.assignments);
    const { list: enrollments, loading: enrollLoading } = useSelector((s) => s.enrollments);

    const [assignments,   setAssignments]   = useState([]);
    const [loadingA,      setLoadingA]      = useState(false);
    const [selected,      setSelected]      = useState(null);
    const [textAnswer,    setTextAnswer]    = useState('');
    const [submitting,    setSubmitting]    = useState(false);
    const [filterStatus,  setFilterStatus]  = useState('all');
    const [fetchedOnce,   setFetchedOnce]   = useState(false);

    /* ── Step 1: load enrollments on mount ── */
    useEffect(() => {
        dispatch(fetchMyEnrollments());
    }, [dispatch]);

    /* ── Step 2: once enrollments loaded, fetch assignments for ALL courses ── */
    useEffect(() => {
        // Wait until enrollments have loaded
        if (enrollLoading) return;

        const activeEnrollments = enrollments.filter((e) => e.status === 'active');

        // Extract course IDs — handle both populated and non-populated
        const courseIds = activeEnrollments
            .map((e) => {
                if (e.course && typeof e.course === 'object') return e.course._id;
                return e.course;
            })
            .filter(Boolean)
            .map(String)
            // deduplicate
            .filter((id, idx, arr) => arr.indexOf(id) === idx);

        if (courseIds.length === 0) {
            setAssignments([]);
            setFetchedOnce(true);
            return;
        }

        const load = async () => {
            setLoadingA(true);
            try {
                const { data } = await api.get(
                    `/assignments?courses=${courseIds.join(',')}`
                );
                setAssignments(data.assignments || []);
                console.log(
                    `Loaded ${data.assignments?.length || 0} assignments for ${courseIds.length} courses`
                );
            } catch (err) {
                console.error('Failed to load assignments:', err);
                setAssignments([]);
            }
            setLoadingA(false);
            setFetchedOnce(true);
        };

        load();
    }, [enrollments, enrollLoading]);

    /* ── Select an assignment ── */
    const handleSelect = (assignment) => {
        setSelected(assignment._id);
        setTextAnswer('');
        dispatch(fetchAssignment(assignment._id));
    };

    /* ── Submit answer ── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!textAnswer.trim()) return;
        setSubmitting(true);
        const result = await dispatch(submitAssignment({ assignmentId: selected, textAnswer }));
        setSubmitting(false);
    };

    const isPast = (date) => new Date(date) < new Date();

    const statusLabel = (a) => {
        if (isPast(a.dueDate)) return { label: 'Overdue', color: '#DC2626', bg: '#FEF2F2' };
        const diff = Math.ceil((new Date(a.dueDate) - new Date()) / 86400000);
        if (diff <= 3) return { label: `Due in ${diff}d`, color: '#D97706', bg: '#FFFBEB' };
        return { label: 'Open', color: '#059669', bg: '#ECFDF5' };
    };

    const filtered = assignments.filter((a) => {
        if (filterStatus === 'open')    return !isPast(a.dueDate);
        if (filterStatus === 'overdue') return isPast(a.dueDate);
        return true;
    });

    const isLoading = enrollLoading || loadingA;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">

                <div className="topbar">
                    <h1 className="topbar__title">Assignments</h1>
                    <div className="topbar__right">
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {[
                                { val: 'all',     label: `All (${assignments.length})` },
                                { val: 'open',    label: `Open (${assignments.filter(a => !isPast(a.dueDate)).length})` },
                                { val: 'overdue', label: `Overdue (${assignments.filter(a => isPast(a.dueDate)).length})` },
                            ].map((tab) => (
                                <button
                                    key={tab.val}
                                    className={`course-status-tab ${filterStatus === tab.val ? 'active' : ''}`}
                                    onClick={() => setFilterStatus(tab.val)}
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="assignment-layout">

                    {/* ── List pane ── */}
                    <div className="assignment-list-pane">
                        {isLoading ? (
                            <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                <p style={{ marginTop: 'var(--space-sm)', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                    {enrollLoading ? 'Loading your courses…' : 'Loading assignments…'}
                                </p>
                            </div>
                        ) : !fetchedOnce ? null
                            : enrollments.filter(e => e.status === 'active').length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                    <div className="empty-state__icon">📚</div>
                                    <p>You are not enrolled in any courses yet.</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                    <div className="empty-state__icon">📝</div>
                                    <p>
                                        {assignments.length === 0
                                            ? 'No assignments have been posted yet.'
                                            : 'No assignments match this filter.'}
                                    </p>
                                </div>
                            ) : (
                                filtered.map((a) => {
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
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-full)',
                                                    background: st.bg, color: st.color,
                                                }}>
                                                {st.label}
                                            </span>
                                            </div>
                                            <div className="assignment-item__title">{a.title}</div>
                                            <div className="assignment-item__meta">
                                                {new Date(a.dueDate).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                })}
                                                {' · '}{a.totalMarks} marks
                                                {a.course?.title && ` · ${a.course.title}`}
                                            </div>
                                            {a.attachmentUrl && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center',
                                                    gap: 4, fontSize: '0.75rem',
                                                    color: 'var(--color-primary)', marginTop: 2,
                                                }}>
                                                    <span>{getFileIcon(a.attachmentUrl)}</span>
                                                    <span>File attached</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                    </div>

                    {/* ── Detail pane ── */}
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
                                    {current.subject?.name && <span>📚 {current.subject.name}</span>}
                                    {current.course?.title  && <span>🎓 {current.course.title}</span>}
                                    <span>📅 Due: {new Date(current.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric',
                                    })}</span>
                                    <span>🎯 {current.totalMarks} marks</span>
                                    <span>✅ Pass: {current.passingMarks}</span>
                                    {current.allowLateSubmission && (
                                        <span style={{ color: '#059669' }}>⏰ Late submission allowed</span>
                                    )}
                                </div>

                                {/* Attachment */}
                                {current.attachmentUrl && (
                                    <div
                                        style={{
                                            marginBottom: 'var(--space-lg)',
                                            padding: 'var(--space-md)',
                                            background: 'var(--color-primary-light)',
                                            border: '1px solid #C7D2FE',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-md)',
                                        }}
                                    >
        <span style={{ fontSize: '1.5rem' }}>
            {getFileIcon(current.attachmentUrl)}
        </span>

                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                    fontSize: '0.875rem',
                                                    color: 'var(--color-primary)',
                                                }}
                                            >
                                                Teacher's reference file
                                            </div>

                                            <div
                                                style={{
                                                    fontSize: '0.8rem',
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                Click to open or download
                                            </div>
                                        </div>

                                        <a
                                            href={current.attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline btn-sm"
                                        >
                                            ⬇ Open file
                                        </a>
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

                                <hr className="divider" />

                                {/* Submission */}
                                {currentSubmission ? (
                                    <div className="submission-result">
                                        <div className="submission-result__header">
                                            <span>Submission status</span>
                                            <span className={`badge ${currentSubmission.status === 'graded' ? 'badge-success' : 'badge-student'}`}>
                                                {currentSubmission.status}
                                            </span>
                                        </div>

                                        {currentSubmission.isLate && (
                                            <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
                                                ⏰ Submitted late
                                            </div>
                                        )}

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
                                                <div style={{
                                                    fontSize: '0.8125rem',
                                                    color: currentSubmission.marks >= current.passingMarks ? '#059669' : '#DC2626',
                                                    fontWeight: 600,
                                                    marginBottom: 'var(--space-sm)',
                                                }}>
                                                    {currentSubmission.marks >= current.passingMarks ? '✓ Passed' : '✗ Did not pass'}
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
                                    /* Submit form */
                                    <div className="submission-form">
                                        <h3 className="submission-form__title">Submit your answer</h3>

                                        {isPast(current.dueDate) && !current.allowLateSubmission ? (
                                            <div className="alert alert-error">
                                                ⏰ The deadline has passed and late submissions are not allowed for this assignment.
                                            </div>
                                        ) : (
                                            <>
                                                {isPast(current.dueDate) && current.allowLateSubmission && (
                                                    <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
                                                        ⏰ Deadline has passed — late submission is still accepted.
                                                    </div>
                                                )}
                                                {error && (
                                                    <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                                                        {error}
                                                    </div>
                                                )}
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
                                                    <button
                                                        type="submit"
                                                        className="btn btn-primary"
                                                        disabled={submitting}
                                                    >
                                                        {submitting
                                                            ? <><span className="spinner"></span> Submitting…</>
                                                            : 'Submit assignment'
                                                        }
                                                    </button>
                                                </form>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            ) : (
                            /* Loading selected assignment details */
                            <div className="empty-state" style={{ height: '100%' }}>
                        <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                    </div>
                    )}
                </div>
            </div>
        </div>
</div>
);
}