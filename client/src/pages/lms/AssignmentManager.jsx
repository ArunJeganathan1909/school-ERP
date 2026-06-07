import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import Sidebar                               from '../../components/Sidebar';
import NotificationBell                      from '../../components/NotificationBell';
import FileUpload                            from '../../components/FileUpload';
import {
  fetchAssignments,
  createAssignment,
}                                            from '../../store/slices/assignmentSlice';
import { fetchCourses }                      from '../../store/slices/courseSlice';
import api                                   from '../../api/axios';

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const EMPTY = {
  title:               '',
  description:         '',
  instructions:        '',
  course:              '',
  subject:             '',
  dueDate:             '',
  totalMarks:          100,
  passingMarks:        40,
  allowLateSubmission: false,
  isPublished:         true,
  attachmentUrl:       '',
};

const isPast = (date) => new Date(date) < new Date();

const getFileName = (url) => {
  if (!url) return '';
  try { return decodeURIComponent(url.split('/').pop().replace(/^\d+-/, '')); }
  catch { return url.split('/').pop(); }
};

const FILE_ICON = (url = '') => {
  const u = url.toLowerCase();
  if (u.endsWith('.pdf'))               return '📄';
  if (u.match(/\.(doc|docx)$/))        return '📝';
  if (u.match(/\.(ppt|pptx)$/))        return '📊';
  if (u.match(/\.(xls|xlsx)$/))        return '📈';
  if (u.match(/\.(jpg|jpeg|png|gif)$/)) return '🖼';
  if (u.endsWith('.zip'))              return '🗜';
  return '📎';
};

const fmt = (date) =>
    new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

const initials = (name = '') =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

const passPct = (assignment) =>
    Math.round((assignment.passingMarks / assignment.totalMarks) * 100);

/* ─────────────────────────────────────────────
   SubmissionDetailModal
───────────────────────────────────────────── */
function SubmissionDetailModal({ submission, assignment, onClose, onGraded }) {
  // Track the "live" graded data separately so the card updates after save
  const [savedGrade, setSavedGrade] = useState(
      submission.status === 'graded'
          ? { marks: submission.marks, feedback: submission.feedback }
          : null
  );
  const [isEditing, setIsEditing] = useState(submission.status !== 'graded');

  // Form fields — initialised from submission; reset to savedGrade when editing starts
  const [marks,    setMarks]    = useState(submission.marks ?? '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  // Enter edit mode pre-filled with the current saved values
  const handleEditClick = () => {
    setMarks(savedGrade?.marks ?? '');
    setFeedback(savedGrade?.feedback || '');
    setError('');
    setIsEditing(true);
  };

  const handleGrade = async (e) => {
    e.preventDefault();
    setError('');
    if (marks === '' || marks === null) { setError('Enter marks to grade.'); return; }
    const m = Number(marks);
    if (isNaN(m) || m < 0 || m > assignment.totalMarks) {
      setError(`Marks must be between 0 and ${assignment.totalMarks}.`);
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put(`/submissions/${submission._id}/grade`, { marks: m, feedback });
      const updated = { marks: m, feedback };
      setSavedGrade(updated);
      setIsEditing(false);
      onGraded(data.submission);
    } catch (err) {
      setError(err.response?.data?.message || 'Grading failed.');
    }
    setSaving(false);
  };

  const pct    = marks !== '' ? Math.round((Number(marks) / assignment.totalMarks) * 100) : null;
  const passing = pct !== null && pct >= passPct(assignment);

  const savedPct = savedGrade?.marks != null
      ? Math.round((savedGrade.marks / assignment.totalMarks) * 100)
      : null;
  const savedPassing = savedPct !== null && savedPct >= passPct(assignment);

  return (
      <div className="modal-overlay" onClick={onClose}>
        <div
            className="modal"
            style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', zIndex: 1100 }}
            onClick={(e) => e.stopPropagation()}
        >
          <div className="modal__header">
            <div>
              <h2 className="modal__title" style={{ marginBottom: 2 }}>
                Submission — {submission.student?.name || 'Student'}
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                {assignment.title}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>

          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

            {/* Student card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)',
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                background: 'var(--color-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)',
              }}>
                {initials(submission.student?.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{submission.student?.name || '—'}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{submission.student?.email || ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span className={`badge ${savedGrade ? 'badge-success' : submission.status === 'returned' ? 'badge-error' : 'badge-warning'}`}>
                {savedGrade ? 'graded' : submission.status}
              </span>
                {submission.isLate && <span style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 600 }}>🕐 Late</span>}
              </div>
            </div>

            {/* Meta strip */}
            <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              <span>📅 Submitted: <strong style={{ color: 'var(--color-text-primary)' }}>{fmt(submission.submittedAt)}</strong></span>
              <span>📋 Due: <strong style={{ color: isPast(assignment.dueDate) ? '#DC2626' : 'var(--color-text-primary)' }}>{fmt(assignment.dueDate)}</strong></span>
              <span>🎯 Max marks: <strong style={{ color: 'var(--color-text-primary)' }}>{assignment.totalMarks}</strong></span>
            </div>

            {/* Written answer */}
            {submission.textAnswer ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: '0.875rem' }}>✍ Written answer</div>
                  <div style={{
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                    fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    maxHeight: 240, overflowY: 'auto',
                  }}>
                    {submission.textAnswer}
                  </div>
                </div>
            ) : (
                <div style={{ padding: 'var(--space-md)', background: '#F9FAFB', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  No written answer provided.
                </div>
            )}

            {/* File */}
            {submission.fileUrl ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                  background: '#ECFDF5', border: '1.5px solid #A7F3D0',
                  borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                }}>
                  <span style={{ fontSize: '1.75rem' }}>{FILE_ICON(submission.fileUrl)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#065F46', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getFileName(submission.fileUrl)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#059669' }}>Submitted file</div>
                  </div>
                  <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" download>
                    ⬇ Open
                  </a>
                </div>
            ) : (
                <div style={{ padding: 'var(--space-md)', background: '#F9FAFB', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  No file attached.
                </div>
            )}

            {/* ── Grading section ── */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>🎓 Grade</div>
                {savedGrade && !isEditing && (
                    <button
                        type="button"
                        className="btn btn-edit-grade btn-sm"
                        onClick={handleEditClick}
                    >
                      ✏ Edit grade
                    </button>
                )}
              </div>

              {/* ── SAVED GRADE CARD (shown after save, not editing) ── */}
              {savedGrade && !isEditing && (
                  <div style={{
                    background: savedPassing ? '#ECFDF5' : '#FEF2F2',
                    border: `1.5px solid ${savedPassing ? '#6EE7B7' : '#FECACA'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-md)',
                  }}>
                    {/* Score row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1, color: savedPassing ? '#059669' : '#DC2626' }}>
                      {savedGrade.marks}
                    </span>
                        <span style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      / {assignment.totalMarks}
                    </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 14px', borderRadius: 'var(--radius-full)',
                      fontWeight: 700, fontSize: '1rem',
                      background: savedPassing ? '#D1FAE5' : '#FEE2E2',
                      color: savedPassing ? '#065F46' : '#991B1B',
                    }}>
                      {savedPct}% &nbsp;—&nbsp; {savedPassing ? '✓ Pass' : '✗ Fail'}
                    </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: 4 }}>
                      Pass threshold: {assignment.passingMarks} / {assignment.totalMarks}
                    </span>
                      </div>

                      {/* Success pill */}
                      <span style={{
                        marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: '0.8125rem', fontWeight: 600,
                        color: '#059669', background: '#D1FAE5',
                        padding: '3px 10px', borderRadius: 'var(--radius-full)',
                      }}>
                    ✓ Grade saved
                  </span>
                    </div>

                    {/* Feedback */}
                    {savedGrade.feedback ? (
                        <div style={{ borderTop: `1px solid ${savedPassing ? '#A7F3D0' : '#FECACA'}`, paddingTop: 'var(--space-sm)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Feedback to student
                          </div>
                          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, color: 'var(--color-text-primary)' }}>
                            {savedGrade.feedback}
                          </p>
                        </div>
                    ) : (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                          No feedback provided.
                        </p>
                    )}
                  </div>
              )}

              {/* ── GRADE FORM (new grade OR editing) ── */}
              {isEditing && (
                  <>
                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

                    <form onSubmit={handleGrade}>
                      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
                        <div className="form-group" style={{ flex: '0 0 160px', marginBottom: 0 }}>
                          <label className="form-label">
                            Marks <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>/ {assignment.totalMarks}</span>
                          </label>
                          <input
                              className="form-input"
                              type="number"
                              min={0}
                              max={assignment.totalMarks}
                              value={marks}
                              onChange={(e) => setMarks(e.target.value)}
                              placeholder={`0–${assignment.totalMarks}`}
                              style={{ fontWeight: 700, fontSize: '1.1rem' }}
                              autoFocus
                          />
                        </div>

                        {pct !== null && (
                            <div style={{ paddingBottom: 2 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '5px 14px', borderRadius: 'var(--radius-full)',
                          fontWeight: 700, fontSize: '0.9375rem',
                          background: passing ? '#ECFDF5' : '#FEF2F2',
                          color: passing ? '#059669' : '#DC2626',
                        }}>
                          {pct}% — {passing ? '✓ Pass' : '✗ Fail'}
                        </span>
                            </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Feedback
                          <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8, fontSize: '0.75rem' }}>
                        (optional — visible to the student)
                      </span>
                        </label>
                        <textarea
                            className="form-input"
                            rows={4}
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Write feedback for the student…"
                            style={{ resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                        {savedGrade && (
                            <button type="button" className="btn btn-ghost" onClick={() => setIsEditing(false)}>
                              Cancel
                            </button>
                        )}
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                          {saving ? <><span className="spinner" /> Saving…</> : savedGrade ? '✓ Update grade' : '✓ Save grade'}
                        </button>
                      </div>
                    </form>
                  </>
              )}

              {/* Close button when viewing saved grade */}
              {savedGrade && !isEditing && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
                  </div>
              )}
            </div>

          </div>
        </div>
      </div>
  );
}

/* ─────────────────────────────────────────────
   SubmissionsModal
───────────────────────────────────────────── */
function SubmissionsModal({ assignment, onClose }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [detailSub,   setDetailSub]   = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/submissions/assignment/${assignment._id}`);
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load submissions.');
    }
    setLoading(false);
  }, [assignment._id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (sub) => {
    if (!window.confirm(`Remove ${sub.student?.name || "this student"}'s submission?\nThis cannot be undone.`)) return;
    setDeletingId(sub._id);
    try {
      await api.delete(`/submissions/${sub._id}`);
      setSubmissions((prev) => prev.filter((s) => s._id !== sub._id));
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
    setDeletingId(null);
  };

  const handleGraded = (updated) => {
    setSubmissions((prev) => prev.map((s) => s._id === updated._id ? { ...s, ...updated } : s));
    setDetailSub((prev) => prev ? { ...prev, ...updated } : prev);
  };

  const graded    = submissions.filter((s) => s.status === 'graded').length;
  const submitted = submissions.filter((s) => s.status === 'submitted').length;
  const pp = passPct(assignment);

  return (
      <>
        <div className="modal-overlay" onClick={onClose}>
          <div
              className="modal"
              style={{ maxWidth: 780, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
              onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__header" style={{ flexShrink: 0 }}>
              <div>
                <h2 className="modal__title" style={{ marginBottom: 2 }}>Submissions</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>{assignment.title}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
            </div>

            {/* Stats */}
            <div style={{
              display: 'flex', gap: 'var(--space-xl)', alignItems: 'center', flexWrap: 'wrap',
              padding: 'var(--space-sm) var(--space-lg)',
              background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
            }}>
              {[
                { label: 'Total',   val: submissions.length, color: 'var(--color-text-primary)' },
                { label: 'Graded',  val: graded,             color: '#059669' },
                { label: 'Pending', val: submitted,          color: '#D97706' },
              ].map((s) => (
                  <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                  </div>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Max: <strong>{assignment.totalMarks}</strong> · Pass: <strong>{assignment.passingMarks}</strong>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }}>
              {loading ? (
                  <div className="empty-state">
                    <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                  </div>
              ) : error ? (
                  <div className="alert alert-error">{error}</div>
              ) : submissions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">📭</div>
                    <p style={{ fontWeight: 600 }}>No submissions yet</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Students haven't submitted anything for this assignment.
                    </p>
                  </div>
              ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {submissions.map((sub) => {
                      const pct = sub.marks != null ? Math.round((sub.marks / assignment.totalMarks) * 100) : null;
                      const pass = pct !== null && pct >= pp;

                      return (
                          <div
                              key={sub._id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                                padding: 'var(--space-md)',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                              }}
                          >
                            {/* Avatar */}
                            <div style={{
                              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                              background: 'var(--color-primary-light)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)',
                            }}>
                              {initials(sub.student?.name)}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {sub.student?.name || 'Unknown student'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                <span>📅 {fmt(sub.submittedAt)}</span>
                                {sub.isLate && <span style={{ color: '#D97706', fontWeight: 600 }}>🕐 Late</span>}
                                {sub.fileUrl    && <span style={{ color: 'var(--color-primary)' }}>{FILE_ICON(sub.fileUrl)} File</span>}
                                {sub.textAnswer && <span>✍ Written</span>}
                              </div>
                            </div>

                            {/* Grade display */}
                            <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 72 }}>
                              {sub.status === 'graded' && pct !== null ? (
                                  <>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: pass ? '#059669' : '#DC2626' }}>
                                      {sub.marks}/{assignment.totalMarks}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: pass ? '#059669' : '#DC2626' }}>
                                      {pct}% — {pass ? 'Pass' : 'Fail'}
                                    </div>
                                  </>
                              ) : (
                                  <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Pending</span>
                              )}
                            </div>

                            {/* Status badge */}
                            <span className={`badge ${sub.status === 'graded' ? 'badge-success' : sub.status === 'returned' ? 'badge-error' : 'badge-warning'}`} style={{ flexShrink: 0 }}>
                        {sub.status}
                      </span>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexShrink: 0 }}>
                              <button className="btn btn-outline btn-sm" onClick={() => setDetailSub(sub)}>
                                View
                              </button>
                              <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDelete(sub)}
                                  disabled={deletingId === sub._id}
                              >
                                {deletingId === sub._id ? '…' : 'Del'}
                              </button>
                            </div>
                          </div>
                      );
                    })}
                  </div>
              )}
            </div>

            <div className="modal__footer" style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)' }}>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>

        {/* Detail modal layered on top */}
        {detailSub && (
            <SubmissionDetailModal
                submission={detailSub}
                assignment={assignment}
                onClose={() => setDetailSub(null)}
                onGraded={handleGraded}
            />
        )}
      </>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function AssignmentManager() {
  const dispatch = useDispatch();
  const { list: assignments, loading } = useSelector((s) => s.assignments);
  const { list: courses }              = useSelector((s) => s.courses);

  const [showForm,       setShowForm]       = useState(false);
  const [editItem,       setEditItem]       = useState(null);
  const [form,           setForm]           = useState(EMPTY);
  const [saving,         setSaving]         = useState(false);
  const [formError,      setFormError]      = useState('');
  const [deletingId,     setDeletingId]     = useState(null);
  const [submissionsFor, setSubmissionsFor] = useState(null);

  const [allSubjects,      setAllSubjects]      = useState([]);
  const [subjectsLoading,  setSubjectsLoading]  = useState(false);
  const [filteredSubjects, setFilteredSubjects] = useState([]);

  useEffect(() => {
    dispatch(fetchCourses({ limit: 100 }));
    dispatch(fetchAssignments({}));
  }, [dispatch]);

  useEffect(() => {
    const load = async () => {
      setSubjectsLoading(true);
      try {
        const { data } = await api.get('/assignments/teacher/subjects');
        setAllSubjects(data.subjects || []);
      } catch { setAllSubjects([]); }
      setSubjectsLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.course) { setFilteredSubjects(allSubjects); return; }
    const filtered = allSubjects.filter(
        (s) => String(s.course?._id || s.course) === String(form.course)
    );
    setFilteredSubjects(filtered);
    const stillValid = filtered.some((s) => s._id === form.subject);
    if (!stillValid) setForm((f) => ({ ...f, subject: '' }));
  }, [form.course, allSubjects]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubjectChange = (e) => {
    const subjectId = e.target.value;
    const subject   = allSubjects.find((s) => s._id === subjectId);
    if (subject) {
      const courseId = subject.course?._id || subject.course;
      setForm((f) => ({ ...f, subject: subjectId, course: courseId ? String(courseId) : f.course }));
    } else {
      setForm((f) => ({ ...f, subject: '' }));
    }
  };

  const openCreate = () => { setEditItem(null); setForm(EMPTY); setFormError(''); setShowForm(true); };

  const openEdit = (a) => {
    setEditItem(a);
    setForm({
      title:               a.title               || '',
      description:         a.description         || '',
      instructions:        a.instructions        || '',
      course:              String(a.course?._id  || a.course  || ''),
      subject:             String(a.subject?._id || a.subject || ''),
      dueDate:             a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 16) : '',
      totalMarks:          a.totalMarks          ?? 100,
      passingMarks:        a.passingMarks         ?? 40,
      allowLateSubmission: a.allowLateSubmission  ?? false,
      isPublished:         a.isPublished          ?? true,
      attachmentUrl:       a.attachmentUrl        || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) { setFormError('Title is required.');       return; }
    if (!form.course)        { setFormError('Please select a course.'); return; }
    if (!form.dueDate)       { setFormError('Due date is required.');   return; }
    const payload = { ...form, subject: form.subject && form.subject !== '' ? form.subject : null };
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/assignments/${editItem._id}`, payload);
        dispatch(fetchAssignments({}));
      } else {
        await dispatch(createAssignment(payload));
      }
      setShowForm(false); setForm(EMPTY); setEditItem(null);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed. Please try again.');
    }
    setSaving(false);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?\nAll student submissions will also be deleted.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/assignments/${id}`);
      dispatch(fetchAssignments({}));
    } catch (err) { alert(err.response?.data?.message || 'Delete failed'); }
    setDeletingId(null);
  };

  const subjectPlaceholder = useCallback(() => {
    if (subjectsLoading)                              return 'Loading your subjects…';
    if (allSubjects.length === 0)                     return 'No subjects assigned to you yet';
    if (form.course && filteredSubjects.length === 0) return 'No subjects for this course';
    return 'Select subject (optional)';
  }, [subjectsLoading, allSubjects, form.course, filteredSubjects]);

  const subjectsToShow = form.course ? filteredSubjects : allSubjects;

  return (
      <div className="app-shell">
        <Sidebar />
        <div className="main-content">

          <div className="topbar">
            <h1 className="topbar__title">Assignment manager</h1>
            <div className="topbar__right">
              <NotificationBell />
              <button className="btn btn-primary" onClick={openCreate}>+ New assignment</button>
            </div>
          </div>

          <div className="page-body">

            {/* Stats strip */}
            <div style={{
              display: 'flex', gap: 'var(--space-xl)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-md) var(--space-xl)',
              marginBottom: 'var(--space-lg)', flexWrap: 'wrap',
            }}>
              {[
                { label: 'Total',     val: assignments.length,                                 color: 'var(--color-text-primary)' },
                { label: 'Published', val: assignments.filter(a => a.isPublished).length,      color: '#059669' },
                { label: 'Active',    val: assignments.filter(a => !isPast(a.dueDate)).length, color: '#D97706' },
                { label: 'Past due',  val: assignments.filter(a => isPast(a.dueDate)).length,  color: '#DC2626' },
                { label: 'With file', val: assignments.filter(a => a.attachmentUrl).length,    color: '#4F46E5' },
              ].map((s) => (
                  <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                  </div>
              ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="empty-state">
                  <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                </div>
            ) : assignments.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">📝</div>
                  <p>No assignments yet.</p>
                  <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openCreate}>
                    Create first assignment
                  </button>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                    <tr>
                      <th>Title</th>
                      <th>Subject</th>
                      <th>Course</th>
                      <th>Due date</th>
                      <th>Marks</th>
                      <th>File</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {assignments.map((a) => (
                        <tr key={a._id}>
                          <td style={{ fontWeight: 500 }}>{a.title}</td>

                          <td>
                            {a.subject ? (
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{a.subject.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>{a.subject.code}</div>
                                </div>
                            ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>—</span>
                            )}
                          </td>

                          <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            {a.course?.title || '—'}
                          </td>

                          <td>
                        <span style={{
                          color: isPast(a.dueDate) ? '#DC2626' : 'var(--color-text-secondary)',
                          fontWeight: isPast(a.dueDate) ? 600 : 400,
                          fontSize: '0.875rem',
                        }}>
                          {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {isPast(a.dueDate) && <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>closed</div>}
                        </span>
                          </td>

                          <td style={{ fontWeight: 600 }}>{a.totalMarks}</td>

                          <td>
                            {a.attachmentUrl ? (
                                <a
                                    href={a.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                    title="Open attachment"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600,
                                      textDecoration: 'none', background: 'var(--color-primary-light)',
                                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                    }}
                                >
                                  📎 File
                                </a>
                            ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>—</span>
                            )}
                          </td>

                          <td>
                        <span className={`badge ${a.isPublished ? 'badge-success' : 'badge-error'}`}>
                          {a.isPublished ? 'Published' : 'Draft'}
                        </span>
                          </td>

                          <td>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                              {/* ── Submissions button ── */}
                              <button
                                  className="btn btn-indigo btn-sm"
                                  onClick={() => setSubmissionsFor(a)}
                                  title="View student submissions"
                              >
                                📬 Submissions
                              </button>

                              <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)}>Edit</button>
                              <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDelete(a._id, a.title)}
                                  disabled={deletingId === a._id}
                              >
                                {deletingId === a._id ? '…' : 'Del'}
                              </button>
                            </div>
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
            )}
          </div>
        </div>

        {/* ── Submissions modal ── */}
        {submissionsFor && (
            <SubmissionsModal
                assignment={submissionsFor}
                onClose={() => setSubmissionsFor(null)}
            />
        )}

        {/* ── Create / Edit modal ── */}
        {showForm && (
            <div className="modal-overlay" onClick={() => setShowForm(false)}>
              <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                  <h2 className="modal__title">
                    {editItem ? `Edit — ${editItem.title}` : 'New assignment'}
                  </h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
                </div>

                {formError && (
                    <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                      {formError}
                    </div>
                )}

                <form className="modal__body" onSubmit={handleSave}>

                  <div className="form-group">
                    <label className="form-label">Assignment title *</label>
                    <input
                        className="form-input" name="title" value={form.title}
                        onChange={handleChange} required placeholder="e.g. Midterm Essay — Chapter 3"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Subject
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8, fontWeight: 400 }}>
                    — selecting a subject auto-fills the course
                  </span>
                    </label>

                    {!subjectsLoading && allSubjects.length === 0 && (
                        <div className="alert alert-info" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.8125rem' }}>
                          ⚠ No subjects assigned to you. Ask your admin to assign subjects.
                        </div>
                    )}
                    {form.course && !subjectsLoading && filteredSubjects.length === 0 && allSubjects.length > 0 && (
                        <div className="alert alert-info" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.8125rem' }}>
                          ⚠ No subjects assigned to you for this course.
                        </div>
                    )}

                    <select className="form-input" name="subject" value={form.subject} onChange={handleSubjectChange} disabled={subjectsLoading}>
                      <option value="">{subjectPlaceholder()}</option>
                      {subjectsToShow.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name} — {s.code}{s.course?.title ? ` (${s.course.title})` : ''}
                          </option>
                      ))}
                    </select>
                    {form.subject && <p style={{ fontSize: '0.75rem', color: '#059669', marginTop: 4 }}>✓ Subject selected</p>}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        Course *
                        {form.course && form.subject && <span style={{ fontSize: '0.7rem', color: '#059669', marginLeft: 6, fontWeight: 400 }}>(auto-filled)</span>}
                      </label>
                      <select className="form-input" name="course" value={form.course} onChange={handleChange} required>
                        <option value="">Select course</option>
                        {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Due date *</label>
                      <input className="form-input" type="datetime-local" name="dueDate" value={form.dueDate} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Total marks</label>
                      <input className="form-input" type="number" name="totalMarks" value={form.totalMarks} onChange={handleChange} min={1} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Passing marks</label>
                      <input className="form-input" type="number" name="passingMarks" value={form.passingMarks} onChange={handleChange} min={0} max={form.totalMarks} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" name="description" value={form.description} onChange={handleChange} rows={2} placeholder="Brief description…" style={{ resize: 'vertical' }} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Instructions</label>
                    <textarea className="form-input" name="instructions" value={form.instructions} onChange={handleChange} rows={3} placeholder="Step-by-step instructions for students…" style={{ resize: 'vertical' }} />
                  </div>

                  <FileUpload
                      label="Attachment (optional)"
                      value={form.attachmentUrl}
                      onChange={(url) => setForm((f) => ({ ...f, attachmentUrl: url || '' }))}
                      folder="assignments"
                      hint="PDF, DOCX, PPTX, XLSX, images or ZIP — max 20 MB"
                  />

                  <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      <input type="checkbox" name="allowLateSubmission" checked={form.allowLateSubmission} onChange={handleChange} />
                      Allow late submission
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      <input type="checkbox" name="isPublished" checked={form.isPublished} onChange={handleChange} />
                      Published (visible to students)
                    </label>
                  </div>

                  <div className="modal__footer">
                    <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? <><span className="spinner" /> Saving…</> : editItem ? 'Save changes' : 'Create assignment'}
                    </button>
                  </div>

                </form>
              </div>
            </div>
        )}
      </div>
  );
}