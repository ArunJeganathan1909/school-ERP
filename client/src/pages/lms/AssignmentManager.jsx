import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import {
  fetchAssignments,
  createAssignment,
} from '../../store/slices/assignmentSlice';
import { fetchCourses } from '../../store/slices/courseSlice';
import api from '../../api/axios';

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
};

export default function AssignmentManager() {
  const dispatch = useDispatch();
  const { list: assignments, loading } = useSelector((s) => s.assignments);
  const { list: courses }              = useSelector((s) => s.courses);

  const [showForm,   setShowForm]   = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // All subjects for this teacher (loaded once)
  const [allSubjects,      setAllSubjects]      = useState([]);
  const [subjectsLoading,  setSubjectsLoading]  = useState(false);

  // Subjects filtered by selected course
  const [filteredSubjects, setFilteredSubjects] = useState([]);

  /* ── load courses + assignments ── */
  useEffect(() => {
    dispatch(fetchCourses({ limit: 100 }));
    dispatch(fetchAssignments({}));
  }, [dispatch]);

  /* ── load ALL subjects for this teacher (once) ── */
  useEffect(() => {
    const load = async () => {
      setSubjectsLoading(true);
      try {
        // Updated endpoint path
        const { data } = await api.get('/assignments/teacher/subjects');
        setAllSubjects(data.subjects || []);
      } catch (err) {
        console.error('Failed to load subjects:', err);
        setAllSubjects([]);
      }
      setSubjectsLoading(false);
    };
    load();
  }, []);

  /* ── filter subjects when course changes ── */
  useEffect(() => {
    if (!form.course) {
      setFilteredSubjects(allSubjects); // show all if no course picked yet
      return;
    }
    const filtered = allSubjects.filter(
        (s) => String(s.course?._id || s.course) === String(form.course)
    );
    setFilteredSubjects(filtered);

    // If current subject doesn't belong to new course, reset it
    const stillValid = filtered.some((s) => s._id === form.subject);
    if (!stillValid) {
      setForm((f) => ({ ...f, subject: '' }));
    }
  }, [form.course, allSubjects]);

  /* ── handle field changes ── */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  /* ── when subject is selected, auto-fill course ── */
  const handleSubjectChange = (e) => {
    const subjectId = e.target.value;
    const subject   = allSubjects.find((s) => s._id === subjectId);

    if (subject) {
      const courseId = subject.course?._id || subject.course;
      setForm((f) => ({
        ...f,
        subject: subjectId,
        course:  courseId ? String(courseId) : f.course,
      }));
    } else {
      setForm((f) => ({ ...f, subject: '' }));
    }
  };

  /* ── open create modal ── */
  const openCreate = () => {
    setEditItem(null);
    setForm(EMPTY);
    setFormError('');
    setShowForm(true);
  };

  /* ── open edit modal ── */
  const openEdit = (a) => {
    setEditItem(a);
    setForm({
      title:               a.title               || '',
      description:         a.description         || '',
      instructions:        a.instructions        || '',
      course:              String(a.course?._id  || a.course || ''),
      subject:             String(a.subject?._id || a.subject || ''),
      dueDate:             a.dueDate
          ? new Date(a.dueDate).toISOString().slice(0, 16)
          : '',
      totalMarks:          a.totalMarks          ?? 100,
      passingMarks:        a.passingMarks         ?? 40,
      allowLateSubmission: a.allowLateSubmission  ?? false,
      isPublished:         a.isPublished          ?? true,
    });
    setFormError('');
    setShowForm(true);
  };

  /* ── save ── */
  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!form.course) {
      setFormError('Please select a course.');
      return;
    }
    if (!form.dueDate) {
      setFormError('Due date is required.');
      return;
    }

    // Build payload — send null for empty subject (not "")
    const payload = {
      ...form,
      subject: form.subject && form.subject !== '' ? form.subject : null,
    };

    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/assignments/${editItem._id}`, payload);
        dispatch(fetchAssignments({}));
      } else {
        await dispatch(createAssignment(payload));
      }
      setShowForm(false);
      setForm(EMPTY);
      setEditItem(null);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed. Please try again.');
    }
    setSaving(false);
  };

  /* ── delete ── */
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? All submissions will be deleted too.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/assignments/${id}`);
      dispatch(fetchAssignments({}));
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
    setDeletingId(null);
  };

  const isPast = (date) => new Date(date) < new Date();

  // Subject dropdown placeholder text
  const subjectPlaceholder = useCallback(() => {
    if (subjectsLoading) return 'Loading your subjects…';
    if (allSubjects.length === 0) return 'No subjects assigned to you yet';
    if (form.course && filteredSubjects.length === 0) return 'No subjects for this course';
    return 'Select subject (optional)';
  }, [subjectsLoading, allSubjects, form.course, filteredSubjects]);

  // Which subjects to show in dropdown
  const subjectsToShow = form.course ? filteredSubjects : allSubjects;

  return (
      <div className="app-shell">
        <Sidebar />
        <div className="main-content">

          <div className="topbar">
            <h1 className="topbar__title">Assignment manager</h1>
            <div className="topbar__right">
              <NotificationBell />
              <button className="btn btn-primary" onClick={openCreate}>
                + New assignment
              </button>
            </div>
          </div>

          <div className="page-body">

            {/* Stats strip */}
            <div style={{
              display: 'flex', gap: 'var(--space-xl)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-md) var(--space-xl)',
              marginBottom: 'var(--space-lg)',
              flexWrap: 'wrap',
            }}>
              {[
                { label: 'Total',     val: assignments.length,                              color: 'var(--color-text-primary)' },
                { label: 'Published', val: assignments.filter(a => a.isPublished).length,  color: '#059669' },
                { label: 'Active',    val: assignments.filter(a => !isPast(a.dueDate)).length, color: '#D97706' },
                { label: 'Past due',  val: assignments.filter(a => isPast(a.dueDate)).length,  color: '#DC2626' },
              ].map((s) => (
                  <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                  </div>
              ))}
            </div>

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
                                                    {new Date(a.dueDate).toLocaleDateString('en-GB', {
                                                      day: 'numeric', month: 'short', year: 'numeric',
                                                    })}
                                                  {isPast(a.dueDate) && (
                                                      <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: 0.8 }}>
                                                            (closed)
                                                        </span>
                                                  )}
                                                </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{a.totalMarks}</td>
                          <td>
                                                <span className={`badge ${a.isPublished ? 'badge-success' : 'badge-error'}`}>
                                                    {a.isPublished ? 'Published' : 'Draft'}
                                                </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
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

        {/* ══ MODAL ══ */}
        {showForm && (
            <div className="modal-overlay" onClick={() => setShowForm(false)}>
              <div
                  className="modal"
                  style={{ maxWidth: 700 }}
                  onClick={(e) => e.stopPropagation()}
              >
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

                  {/* Title */}
                  <div className="form-group">
                    <label className="form-label">Assignment title *</label>
                    <input
                        className="form-input"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Midterm Essay — Chapter 3"
                    />
                  </div>

                  {/* Subject — pick first, course auto-fills */}
                  <div className="form-group">
                    <label className="form-label">
                      Subject
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8, fontWeight: 400 }}>
                                        — selecting a subject will auto-fill the course
                                    </span>
                    </label>

                    {/* Warning if no subjects */}
                    {!subjectsLoading && allSubjects.length === 0 && (
                        <div className="alert alert-info" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.8125rem' }}>
                          ⚠ You have no subjects assigned. Ask your admin to assign subjects to your account.
                        </div>
                    )}

                    {/* Warning if course selected but no subjects for it */}
                    {form.course && !subjectsLoading && filteredSubjects.length === 0 && allSubjects.length > 0 && (
                        <div className="alert alert-info" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.8125rem' }}>
                          ⚠ No subjects assigned to you for this course.
                        </div>
                    )}

                    <select
                        className="form-input"
                        name="subject"
                        value={form.subject}
                        onChange={handleSubjectChange}
                        disabled={subjectsLoading}
                    >
                      <option value="">{subjectPlaceholder()}</option>
                      {subjectsToShow.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name} — {s.code}
                            {s.course?.title ? ` (${s.course.title})` : ''}
                          </option>
                      ))}
                    </select>

                    {form.subject && (
                        <p style={{ fontSize: '0.75rem', color: '#059669', marginTop: 4 }}>
                          ✓ Subject selected
                        </p>
                    )}
                  </div>

                  {/* Course + Due date */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        Course *
                        {form.course && form.subject && (
                            <span style={{ fontSize: '0.7rem', color: '#059669', marginLeft: 6, fontWeight: 400 }}>
                                                (auto-filled from subject)
                                            </span>
                        )}
                      </label>
                      <select
                          className="form-input"
                          name="course"
                          value={form.course}
                          onChange={handleChange}
                          required
                      >
                        <option value="">Select course</option>
                        {courses.map((c) => (
                            <option key={c._id} value={c._id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Due date *</label>
                      <input
                          className="form-input"
                          type="datetime-local"
                          name="dueDate"
                          value={form.dueDate}
                          onChange={handleChange}
                          required
                      />
                    </div>
                  </div>

                  {/* Marks */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Total marks</label>
                      <input
                          className="form-input"
                          type="number"
                          name="totalMarks"
                          value={form.totalMarks}
                          onChange={handleChange}
                          min={1}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Passing marks</label>
                      <input
                          className="form-input"
                          type="number"
                          name="passingMarks"
                          value={form.passingMarks}
                          onChange={handleChange}
                          min={0}
                          max={form.totalMarks}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                        className="form-input"
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Brief description of what students need to do…"
                        style={{ resize: 'vertical' }}
                    />
                  </div>

                  {/* Instructions */}
                  <div className="form-group">
                    <label className="form-label">Instructions</label>
                    <textarea
                        className="form-input"
                        name="instructions"
                        value={form.instructions}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Step-by-step instructions for students…"
                        style={{ resize: 'vertical' }}
                    />
                  </div>

                  {/* Checkboxes */}
                  <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      <input
                          type="checkbox"
                          name="allowLateSubmission"
                          checked={form.allowLateSubmission}
                          onChange={handleChange}
                      />
                      Allow late submission
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      <input
                          type="checkbox"
                          name="isPublished"
                          checked={form.isPublished}
                          onChange={handleChange}
                      />
                      Published (visible to students)
                    </label>
                  </div>

                  <div className="modal__footer">
                    <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving
                          ? <><span className="spinner"></span> Saving…</>
                          : editItem ? 'Save changes' : 'Create assignment'
                      }
                    </button>
                  </div>

                </form>
              </div>
            </div>
        )}
      </div>
  );
}