import { useEffect, useState }               from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import { fetchAssignment, submitAssignment } from '../../store/slices/assignmentSlice';
import { fetchMyEnrollments }                from '../../store/slices/enrollmentSlice';
import Sidebar                               from '../../components/Sidebar';
import NotificationBell                      from '../../components/NotificationBell';
import { uploadSubmissionFile }              from '../../utils/supabase';
import api                                   from '../../api/axios';
import './AssignmentList.css';

/* ── allowed types for student submission ── */
const SUBMISSION_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/gif',
    'text/plain',
    'application/zip', 'application/x-zip-compressed',
];

const FILE_ICON = (url = '') => {
    if (!url) return '📎';
    const u = url.toLowerCase();
    if (u.endsWith('.pdf'))                return '📄';
    if (u.match(/\.(doc|docx)$/))         return '📝';
    if (u.match(/\.(ppt|pptx)$/))         return '📊';
    if (u.match(/\.(xls|xlsx)$/))         return '📈';
    if (u.match(/\.(jpg|jpeg|png|gif)$/)) return '🖼';
    if (u.endsWith('.zip'))               return '🗜';
    return '📎';
};

const getFileName = (url) => {
    if (!url) return '';
    try {
        return decodeURIComponent(url.split('/').pop().replace(/^\d+-/, ''));
    } catch {
        return url.split('/').pop();
    }
};

export default function AssignmentList() {
    const dispatch = useDispatch();

    const { current, currentSubmission, error: assignError } = useSelector((s) => s.assignments);
    const { list: enrollments, loading: enrollLoading }      = useSelector((s) => s.enrollments);

    /* local assignment list */
    const [assignments,  setAssignments]  = useState([]);
    const [assLoading,   setAssLoading]   = useState(false);

    /* selection */
    const [selected,     setSelected]     = useState(null);

    /* submission form */
    const [textAnswer,   setTextAnswer]   = useState('');
    const [submitting,   setSubmitting]   = useState(false);
    const [submitError,  setSubmitError]  = useState('');

    /* file upload for submission */
    const [subFile,      setSubFile]      = useState(null);
    const [subFileUrl,   setSubFileUrl]   = useState('');
    const [uploading,    setUploading]    = useState(false);
    const [uploadPct,    setUploadPct]    = useState(0);
    const [uploadError,  setUploadError]  = useState('');

    /* filters */
    const [statusFilter, setStatusFilter] = useState('all');
    const [courseFilter, setCourseFilter] = useState('all');

    /* ── load enrollments ── */
    useEffect(() => {
        dispatch(fetchMyEnrollments());
    }, [dispatch]);

    /* ── load assignments for ALL enrolled courses ── */
    useEffect(() => {
        const active = enrollments.filter(e => e.status === 'active');
        if (active.length === 0) return;

        const courseIds = active
            .map(e => e.course?._id || e.course)
            .filter(Boolean);

        if (courseIds.length === 0) return;

        const load = async () => {
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

        load();
    }, [enrollments]);

    /* ── reset submission form when assignment changes ── */
    const handleSelect = (assignment) => {
        setSelected(assignment._id);
        setTextAnswer('');
        setSubFile(null);
        setSubFileUrl('');
        setSubmitError('');
        setUploadError('');
        dispatch(fetchAssignment(assignment._id));
    };

    /* ── handle file selection for submission ── */
    const handleSubFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setUploadError('');

        if (!SUBMISSION_TYPES.includes(file.type)) {
            setUploadError('File type not allowed. Use PDF, Word, PowerPoint, Excel, images or ZIP.');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setUploadError('File too large. Maximum size is 20 MB.');
            return;
        }

        setSubFile(file);
        setUploading(true);
        setUploadPct(10);

        const interval = setInterval(() => {
            setUploadPct(p => Math.min(p + 12, 88));
        }, 300);

        try {
            const { url } = await uploadSubmissionFile(file);
            clearInterval(interval);
            setUploadPct(100);
            setSubFileUrl(url);
            setTimeout(() => setUploadPct(0), 600);
        } catch (err) {
            clearInterval(interval);
            setUploadError(`Upload failed: ${err.message}`);
            setSubFile(null);
            setSubFileUrl('');
            setUploadPct(0);
        }

        setUploading(false);
    };

    const handleRemoveSubFile = () => {
        setSubFile(null);
        setSubFileUrl('');
        setUploadError('');
    };

    /* ── submit ── */
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!textAnswer.trim() && !subFileUrl) {
            setSubmitError('Please write an answer or upload a file (or both).');
            return;
        }

        setSubmitting(true);
        setSubmitError('');

        const result = await dispatch(
            submitAssignment({
                assignmentId: selected,
                textAnswer:   textAnswer.trim(),
                fileUrl:      subFileUrl || undefined,
            })
        );

        if (submitAssignment.rejected.match(result)) {
            setSubmitError(result.payload || 'Submission failed. Please try again.');
        }

        setSubmitting(false);
    };

    /* ── helpers ── */
    const isPast = (date) => new Date(date) < new Date();

    const statusLabel = (a) => {
        if (isPast(a.dueDate)) return { label: 'Overdue',        color: '#DC2626', bg: '#FEF2F2' };
        const diff = Math.ceil((new Date(a.dueDate) - new Date()) / 86400000);
        if (diff === 0) return    { label: 'Due today',       color: '#DC2626', bg: '#FEF2F2' };
        if (diff <= 3)  return    { label: `Due in ${diff}d`, color: '#D97706', bg: '#FFFBEB' };
        return                    { label: 'Open',             color: '#059669', bg: '#ECFDF5' };
    };

    /* ── filter courses ── */
    const enrolledCourses = enrollments
        .filter(e => e.status === 'active' && e.course)
        .map(e => ({
            _id:   e.course?._id  || e.course,
            title: e.course?.title || e.course?.code || 'Course',
        }))
        .filter((c, i, arr) =>
            arr.findIndex(x => String(x._id) === String(c._id)) === i
        );

    /* ── apply filters ── */
    const filtered = assignments.filter(a => {
        if (courseFilter !== 'all' &&
            String(a.course?._id || a.course) !== String(courseFilter)) return false;
        if (statusFilter === 'open'    &&  isPast(a.dueDate)) return false;
        if (statusFilter === 'overdue' && !isPast(a.dueDate)) return false;
        return true;
    });

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

                {/* ── Topbar ── */}
                <div className="topbar">
                    <h1 className="topbar__title">Assignments</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        {assignments.length > 0 && (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                {filtered.length} of {assignments.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Filter bar ── */}
                {assignments.length > 0 && (
                    <div className="assignment-filter-bar">
                        <div className="assignment-filter-group">
                            {[
                                { key: 'all',     label: `All (${counts.all})`        },
                                { key: 'open',    label: `Open (${counts.open})`       },
                                { key: 'overdue', label: `Overdue (${counts.overdue})` },
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

                    {/* ══ LEFT: list pane ══ */}
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
                                <p>Not enrolled in any courses.</p>
                            </div>

                        ) : assignments.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">📝</div>
                                <p>No assignments yet.</p>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                    Your teachers haven't posted any assignments.
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
                                    <div className="assignment-item__meta" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                                        {a.course?.title || a.course?.code || ''}
                                    </div>
                                    <div className="assignment-item__meta">
                                        📅 {new Date(a.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'short', year: 'numeric',
                                    })} · 🎯 {a.totalMarks} marks
                                        {a.attachmentUrl && (
                                            <span style={{ marginLeft: 6, color: 'var(--color-primary)' }}>· 📎</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ══ RIGHT: detail pane ══ */}
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

                                {/* ── Title ── */}
                                <h2 className="assignment-detail__title">{current.title}</h2>

                                {/* ── Meta ── */}
                                <div className="assignment-detail__meta">
                                    {current.subject?.name && (
                                        <span>📖 {current.subject.name}
                                            {current.subject.code && ` (${current.subject.code})`}
                                        </span>
                                    )}
                                    {current.course?.title && (
                                        <span>📚 {current.course.title}</span>
                                    )}
                                    <span>
                                        📅 {new Date(current.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                    </span>
                                    <span>🎯 {current.totalMarks} marks</span>
                                    <span>✅ Pass: {current.passingMarks}</span>
                                    {current.allowLateSubmission && (
                                        <span style={{ color: '#059669' }}>🕐 Late submissions allowed</span>
                                    )}
                                </div>

                                {/* ── Overdue warning ── */}
                                {isPast(current.dueDate) && !currentSubmission && (
                                    <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>
                                        ⚠ This assignment is past its due date.
                                        {current.allowLateSubmission
                                            ? ' Late submissions are accepted.'
                                            : ' Submissions are no longer accepted.'
                                        }
                                    </div>
                                )}

                                {/* ── Description ── */}
                                {current.description && (
                                    <div className="assignment-detail__desc">
                                        {current.description}
                                    </div>
                                )}

                                {/* ── Instructions ── */}
                                {current.instructions && (
                                    <div className="assignment-detail__instructions">
                                        <strong>Instructions:</strong>
                                        <p style={{ marginTop: 'var(--space-xs)', whiteSpace: 'pre-wrap' }}>
                                            {current.instructions}
                                        </p>
                                    </div>
                                )}

                                {/* ── Teacher attachment ── */}
                                {current.attachmentUrl && current.attachmentUrl.trim() !== '' && (
                                    <div className="assignment-attachment">
                                        <div className="assignment-attachment__icon">
                                            {FILE_ICON(current.attachmentUrl)}
                                        </div>
                                        <div className="assignment-attachment__info">
                                            <span className="assignment-attachment__label">
                                                📎 Attachment from teacher
                                            </span>
                                            <span className="assignment-attachment__name">
                                                {getFileName(current.attachmentUrl)}
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

                                {/* ══ SUBMISSION SECTION ══ */}

                                {currentSubmission ? (
                                    /* ── Already submitted ── */
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

                                        <div style={{
                                            fontSize: '0.8125rem',
                                            color: 'var(--color-text-muted)',
                                            marginBottom: 'var(--space-md)',
                                        }}>
                                            Submitted: {new Date(currentSubmission.submittedAt).toLocaleDateString('en-GB', {
                                            day: 'numeric', month: 'long', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                        </div>

                                        {/* Student's text answer */}
                                        {currentSubmission.textAnswer && (
                                            <div className="submission-result__answer">
                                                <strong>Your answer:</strong>
                                                <p style={{ marginTop: 'var(--space-xs)', whiteSpace: 'pre-wrap' }}>
                                                    {currentSubmission.textAnswer}
                                                </p>
                                            </div>
                                        )}

                                        {/* Student's submitted file */}
                                        {currentSubmission.fileUrl && (
                                            <div className="submission-file-card">
                                                <div className="submission-file-card__icon">
                                                    {FILE_ICON(currentSubmission.fileUrl)}
                                                </div>
                                                <div className="submission-file-card__info">
                                                    <span className="submission-file-card__label">
                                                        Your submitted file
                                                    </span>
                                                    <span className="submission-file-card__name">
                                                        {getFileName(currentSubmission.fileUrl)}
                                                    </span>
                                                </div>
                                                <a
                                                    href={currentSubmission.fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-outline btn-sm"
                                                    download
                                                >
                                                    ⬇ View file
                                                </a>
                                            </div>
                                        )}

                                        {/* Grade */}
                                        {currentSubmission.status === 'graded' && (
                                            <div className="submission-result__grade">
                                                <div className="grade-score">
                                                    <span className="grade-score__value">
                                                        {currentSubmission.marks}
                                                    </span>
                                                    <span className="grade-score__total">
                                                        / {current.totalMarks}
                                                    </span>
                                                    <span style={{
                                                        marginLeft: 'var(--space-sm)',
                                                        fontSize: '0.9375rem',
                                                        fontWeight: 700,
                                                        color: currentSubmission.marks >= current.passingMarks
                                                            ? '#059669' : '#DC2626',
                                                    }}>
                                                        ({Math.round((currentSubmission.marks / current.totalMarks) * 100)}%)
                                                        &nbsp;—&nbsp;
                                                        {currentSubmission.marks >= current.passingMarks ? '✓ Pass' : '✗ Fail'}
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

                                        {currentSubmission.status === 'submitted' && (
                                            <p style={{
                                                marginTop: 'var(--space-md)',
                                                fontSize: '0.875rem',
                                                color: 'var(--color-text-muted)',
                                                fontStyle: 'italic',
                                            }}>
                                                ⏳ Awaiting review from your teacher.
                                            </p>
                                        )}
                                    </div>

                                ) : isPast(current.dueDate) && !current.allowLateSubmission ? (
                                    /* ── Submissions closed ── */
                                    <div className="empty-state" style={{ paddingTop: 'var(--space-lg)' }}>
                                        <div className="empty-state__icon">🔒</div>
                                        <p style={{ fontWeight: 600 }}>Submissions closed</p>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                            The deadline has passed and late submissions are not allowed.
                                        </p>
                                    </div>

                                ) : (
                                    /* ── Submit form ── */
                                    <div className="submission-form">
                                        <h3 className="submission-form__title">
                                            Submit your answer
                                            {isPast(current.dueDate) && (
                                                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#D97706', fontWeight: 400 }}>
                                                    (late submission)
                                                </span>
                                            )}
                                        </h3>

                                        {(submitError || assignError) && (
                                            <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                                                {submitError || assignError}
                                            </div>
                                        )}

                                        <form onSubmit={handleSubmit}>

                                            {/* Text answer */}
                                            <div className="form-group">
                                                <label className="form-label">Written answer</label>
                                                <textarea
                                                    className="form-input"
                                                    rows={6}
                                                    value={textAnswer}
                                                    onChange={(e) => setTextAnswer(e.target.value)}
                                                    placeholder="Type your answer here… Be thorough and clear."
                                                    style={{ resize: 'vertical' }}
                                                />
                                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, textAlign: 'right' }}>
                                                    {textAnswer.length} characters
                                                </p>
                                            </div>

                                            {/* File upload */}
                                            <div className="form-group">
                                                <label className="form-label">
                                                    Attach a file
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8, fontWeight: 400 }}>
                                                        (optional — PDF, DOCX, images, ZIP · max 20 MB)
                                                    </span>
                                                </label>

                                                {subFileUrl ? (
                                                    /* File uploaded — show preview */
                                                    <div className="submission-upload-preview">
                                                        <div className="submission-upload-preview__icon">
                                                            {FILE_ICON(subFileUrl)}
                                                        </div>
                                                        <div className="submission-upload-preview__info">
                                                            <span className="submission-upload-preview__name">
                                                                {getFileName(subFileUrl)}
                                                            </span>
                                                            <span className="submission-upload-preview__ready">
                                                                ✓ Ready to submit
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-danger btn-sm"
                                                            onClick={handleRemoveSubFile}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ) : uploading ? (
                                                    /* Uploading progress */
                                                    <div className="submission-upload-progress">
                                                        <div className="submission-upload-progress__label">
                                                            ⬆ Uploading {subFile?.name}…
                                                        </div>
                                                        <div className="submission-upload-progress__bar">
                                                            <div
                                                                className="submission-upload-progress__fill"
                                                                style={{ width: `${uploadPct}%` }}
                                                            />
                                                        </div>
                                                        <div className="submission-upload-progress__pct">
                                                            {uploadPct}%
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Drop zone */
                                                    <label className="submission-upload-zone">
                                                        <input
                                                            type="file"
                                                            accept={SUBMISSION_TYPES.join(',')}
                                                            onChange={handleSubFileChange}
                                                            style={{ display: 'none' }}
                                                        />
                                                        <span className="submission-upload-zone__icon">📎</span>
                                                        <span className="submission-upload-zone__text">
                                                            Click to attach a file
                                                        </span>
                                                    </label>
                                                )}

                                                {uploadError && (
                                                    <div className="file-upload__error" style={{ marginTop: 'var(--space-xs)' }}>
                                                        ⚠ {uploadError}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Validation hint */}
                                            {!textAnswer.trim() && !subFileUrl && (
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                                                    ℹ You can submit a written answer, a file, or both.
                                                </p>
                                            )}

                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={submitting || uploading || (!textAnswer.trim() && !subFileUrl)}
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