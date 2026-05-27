import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import { fetchAssignments, createAssignment } from '../../store/slices/assignmentSlice';
import { fetchCourses } from '../../store/slices/courseSlice';
// import './AssignmentManager.css';

const EMPTY = {
    title: '', description: '', instructions: '', course: '', subject: '',
    dueDate: '', totalMarks: 100, passingMarks: 40, allowLateSubmission: false, isPublished: true,
};

export default function AssignmentManager() {
    const dispatch = useDispatch();
    const { list: assignments, loading } = useSelector((s) => s.assignments);
    const { list: courses } = useSelector((s) => s.courses);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        dispatch(fetchCourses({ limit: 100 }));
        dispatch(fetchAssignments({}));
    }, [dispatch]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        await dispatch(createAssignment(form));
        setSaving(false);
        setShowForm(false);
        setForm(EMPTY);
    };

    const isPast = (date) => new Date(date) < new Date();

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Assignment manager</h1>
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New assignment</button>
                </div>

                <div className="page-body">
                    {loading ? (
                        <div className="empty-state"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div></div>
                    ) : assignments.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📝</div>
                            <p>No assignments yet.</p>
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => setShowForm(true)}>Create first assignment</button>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Subject</th>
                                    <th>Due date</th>
                                    <th>Marks</th>
                                    <th>Status</th>
                                </tr>
                                </thead>
                                <tbody>
                                {assignments.map((a) => (
                                    <tr key={a._id}>
                                        <td style={{ fontWeight: 500 }}>{a.title}</td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{a.subject?.name || '—'}</td>
                                        <td style={{ color: isPast(a.dueDate) ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
                                            {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td>{a.totalMarks}</td>
                                        <td>
                        <span className={`badge ${a.isPublished ? 'badge-success' : 'badge-error'}`}>
                          {a.isPublished ? 'Published' : 'Draft'}
                        </span>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">New assignment</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <form className="modal__body" onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Title *</label>
                                <input className="form-input" name="title" value={form.title} onChange={handleChange} required placeholder="Assignment title" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Course *</label>
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
                                    <input className="form-input" type="number" name="passingMarks" value={form.passingMarks} onChange={handleChange} min={0} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" name="description" value={form.description} onChange={handleChange} rows={3} style={{ resize: 'vertical' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Instructions</label>
                                <textarea className="form-input" name="instructions" value={form.instructions} onChange={handleChange} rows={3} style={{ resize: 'vertical' }} />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.875rem' }}>
                                <input type="checkbox" name="allowLateSubmission" checked={form.allowLateSubmission} onChange={handleChange} />
                                Allow late submission
                            </label>
                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner"></span> Saving…</> : 'Create assignment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}