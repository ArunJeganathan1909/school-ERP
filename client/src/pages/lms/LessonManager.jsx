import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import { fetchLessons, createLesson, updateLesson, deleteLesson } from '../../store/slices/lessonSlice';
import { fetchCourses } from '../../store/slices/courseSlice';
// import './LessonManager.css';

const EMPTY = { title: '', type: 'text', content: '', externalUrl: '', duration: 0, isPublished: false, course: '', subject: '' };

export default function LessonManager() {
    const dispatch = useDispatch();
    const { list: lessons, loading } = useSelector((s) => s.lessons);
    const { list: courses } = useSelector((s) => s.courses);
    const { user } = useSelector((s) => s.auth);

    const [showForm, setShowForm] = useState(false);
    const [editLesson, setEditLesson] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [filterCourse, setFilterCourse] = useState('');

    useEffect(() => {
        dispatch(fetchCourses({ limit: 100 }));
    }, [dispatch]);

    useEffect(() => {
        const params = {};
        if (filterCourse) params.course = filterCourse;
        dispatch(fetchLessons(params));
    }, [dispatch, filterCourse]);

    const handleEdit = (lesson) => {
        setEditLesson(lesson);
        setForm({
            title: lesson.title,
            type: lesson.type,
            content: lesson.content || '',
            externalUrl: lesson.externalUrl || '',
            duration: lesson.duration || 0,
            isPublished: lesson.isPublished,
            course: lesson.course?._id || lesson.course || '',
            subject: lesson.subject?._id || lesson.subject || '',
        });
        setShowForm(true);
    };

    const handleNew = () => { setEditLesson(null); setForm(EMPTY); setShowForm(true); };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        if (editLesson) {
            await dispatch(updateLesson({ id: editLesson._id, data: form }));
        } else {
            await dispatch(createLesson(form));
        }
        setSaving(false);
        setShowForm(false);
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Delete lesson "${title}"?`)) return;
        dispatch(deleteLesson(id));
    };

    const typeColors = {
        text: '#4F46E5', video: '#7C3AED', pdf: '#DC2626',
        link: '#059669', slide: '#D97706',
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Lesson manager</h1>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        <select
                            className="form-input"
                            style={{ width: 200, padding: '7px 12px' }}
                            value={filterCourse}
                            onChange={(e) => setFilterCourse(e.target.value)}
                        >
                            <option value="">All courses</option>
                            {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                        <button className="btn btn-primary" onClick={handleNew}>+ Add lesson</button>
                    </div>
                </div>

                <div className="page-body">
                    {loading ? (
                        <div className="empty-state"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div></div>
                    ) : lessons.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📚</div>
                            <p>No lessons yet. Create your first lesson.</p>
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={handleNew}>+ Add lesson</button>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th>Subject</th>
                                    <th>Order</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {lessons.map((lesson) => (
                                    <tr key={lesson._id}>
                                        <td style={{ fontWeight: 500 }}>{lesson.title}</td>
                                        <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: typeColors[lesson.type] + '18', color: typeColors[lesson.type], textTransform: 'capitalize' }}>
                          {lesson.type}
                        </span>
                                        </td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{lesson.subject?.name || '—'}</td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{lesson.order}</td>
                                        <td>
                        <span className={`badge ${lesson.isPublished ? 'badge-success' : 'badge-error'}`}>
                          {lesson.isPublished ? 'Published' : 'Draft'}
                        </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                                <button className="btn btn-outline btn-sm" onClick={() => handleEdit(lesson)}>Edit</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lesson._id, lesson.title)}>Delete</button>
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

            {/* Lesson form modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">{editLesson ? 'Edit lesson' : 'New lesson'}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <form className="modal__body" onSubmit={handleSave}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Title *</label>
                                    <input className="form-input" name="title" value={form.title} onChange={handleChange} required placeholder="Lesson title" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <select className="form-input" name="type" value={form.type} onChange={handleChange}>
                                        {['text', 'video', 'pdf', 'link', 'slide'].map((t) => (
                                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Course</label>
                                    <select className="form-input" name="course" value={form.course} onChange={handleChange} required>
                                        <option value="">Select course</option>
                                        {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Duration (minutes)</label>
                                    <input className="form-input" type="number" name="duration" value={form.duration} onChange={handleChange} min={0} />
                                </div>
                            </div>

                            {(form.type === 'text') && (
                                <div className="form-group">
                                    <label className="form-label">Content</label>
                                    <textarea className="form-input" name="content" value={form.content} onChange={handleChange} rows={8} placeholder="Write lesson content here… supports basic HTML" style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }} />
                                </div>
                            )}

                            {(form.type === 'link' || form.type === 'video' || form.type === 'pdf') && (
                                <div className="form-group">
                                    <label className="form-label">URL / Link</label>
                                    <input className="form-input" name="externalUrl" value={form.externalUrl} onChange={handleChange} placeholder="https://…" />
                                </div>
                            )}

                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                <input type="checkbox" name="isPublished" checked={form.isPublished} onChange={handleChange} />
                                Publish this lesson (students can see it)
                            </label>

                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner"></span> Saving…</> : editLesson ? 'Update' : 'Create lesson'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}