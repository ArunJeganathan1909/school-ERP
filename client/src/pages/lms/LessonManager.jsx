import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import {
    fetchLessons,
    createLesson,
    updateLesson,
    deleteLesson,
} from '../../store/slices/lessonSlice';
import { uploadLessonFile } from '../../utils/supabase';
import api from '../../api/axios';

/* ─────────────────── constants ─────────────────── */
const TYPE_META = {
    text:  { label: 'Text',  icon: '📄', color: '#4F46E5', desc: 'Written content, notes, HTML' },
    video: { label: 'Video', icon: '🎬', color: '#7C3AED', desc: 'Video file or YouTube/Vimeo link' },
    pdf:   { label: 'PDF',   icon: '📑', color: '#DC2626', desc: 'PDF document upload or link' },
    link:  { label: 'Link',  icon: '🔗', color: '#059669', desc: 'External website or resource' },
    slide: { label: 'Slide', icon: '📊', color: '#D97706', desc: 'Presentation file' },
};

const EMPTY_FORM = {
    title:       '',
    type:        'text',
    content:     '',       // text body (always available)
    externalUrl: '',       // link / embed URL (always available)
    fileUrl:     '',       // uploaded file URL (always available)
    duration:    0,
    isPublished: false,
    course:      '',
    subject:     '',
    order:       0,
};

/* ─────────────────── component ─────────────────── */
export default function LessonManager() {
    const dispatch = useDispatch();
    const { list: lessons, loading, error: lessonError } = useSelector((s) => s.lessons);
    const { user } = useSelector((s) => s.auth);

    /* teacher's own courses + subjects */
    const [myCourses,  setMyCourses]  = useState([]);
    const [mySubjects, setMySubjects] = useState([]);   // all teacher's subjects
    const [filteredSubjects, setFilteredSubjects] = useState([]); // subjects for selected course

    /* list filter */
    const [filterCourse, setFilterCourse] = useState('');

    /* modal */
    const [showForm,    setShowForm]    = useState(false);
    const [editLesson,  setEditLesson]  = useState(null);
    const [form,        setForm]        = useState(EMPTY_FORM);

    /* file upload state */
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadError,   setUploadError]   = useState('');
    const [uploadedFileName, setUploadedFileName] = useState('');

    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    /* ── load teacher's subjects (and derive courses from them) ── */
    useEffect(() => {
        if (!user?._id) return;
        api.get(`/subjects?teacher=${user._id}`)
            .then(({ data }) => {
                const subjects = data.subjects || [];
                setMySubjects(subjects);

                // Derive unique courses from the subjects
                const courseMap = {};
                subjects.forEach((s) => {
                    if (s.course) {
                        const id = s.course._id || s.course;
                        if (!courseMap[id]) {
                            courseMap[id] = s.course;
                        }
                    }
                });
                setMyCourses(Object.values(courseMap));
            })
            .catch(() => { setMyCourses([]); setMySubjects([]); });
    }, [user?._id]);

    /* ── load lessons (filtered by course) ── */
    useEffect(() => {
        const params = {};
        if (filterCourse) params.course = filterCourse;
        dispatch(fetchLessons(params));
    }, [dispatch, filterCourse]);

    /* ── when form course changes, filter subjects ── */
    useEffect(() => {
        if (!form.course) {
            setFilteredSubjects([]);
            setForm((f) => ({ ...f, subject: '' }));
            return;
        }
        const subs = mySubjects.filter((s) => {
            const cid = s.course?._id || s.course;
            return String(cid) === String(form.course);
        });
        setFilteredSubjects(subs);
        // Reset subject if current selection no longer valid
        const stillValid = subs.find((s) => s._id === form.subject);
        if (!stillValid) setForm((f) => ({ ...f, subject: '' }));
    }, [form.course, mySubjects]);

    /* ── handlers ── */
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFile(true);
        setUploadError('');
        setUploadedFileName('');

        try {
            const { url } = await uploadLessonFile(file);
            setForm((f) => ({ ...f, fileUrl: url }));
            setUploadedFileName(file.name);
        } catch (err) {
            setUploadError(`Upload failed: ${err.message}`);
        }
        setUploadingFile(false);
    };

    const clearFile = () => {
        setForm((f) => ({ ...f, fileUrl: '' }));
        setUploadedFileName('');
        setUploadError('');
    };

    const openNew = () => {
        setEditLesson(null);
        setForm(EMPTY_FORM);
        setUploadedFileName('');
        setUploadError('');
        setFormError('');
        setShowForm(true);
    };

    const openEdit = (lesson) => {
        setEditLesson(lesson);
        setForm({
            title:       lesson.title       || '',
            type:        lesson.type        || 'text',
            content:     lesson.content     || '',
            externalUrl: lesson.externalUrl || '',
            fileUrl:     lesson.fileUrl     || '',
            duration:    lesson.duration    || 0,
            isPublished: lesson.isPublished || false,
            course:      lesson.course?._id || lesson.course || '',
            subject:     lesson.subject?._id || lesson.subject || '',
            order:       lesson.order       || 0,
        });
        setUploadedFileName(lesson.fileUrl ? '(existing file)' : '');
        setUploadError('');
        setFormError('');
        setShowForm(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!form.course)   return setFormError('Please select a course.');
        if (!form.subject)  return setFormError('Please select a subject.');
        if (!form.title.trim()) return setFormError('Title is required.');

        // Need at least one content source
        if (!form.content.trim() && !form.externalUrl.trim() && !form.fileUrl) {
            return setFormError('Add at least one content source — text, a URL, or an uploaded file.');
        }

        setSaving(true);
        const payload = { ...form };

        try {
            if (editLesson) {
                await dispatch(updateLesson({ id: editLesson._id, data: payload }));
            } else {
                await dispatch(createLesson(payload));
            }
            setShowForm(false);
        } catch (err) {
            setFormError(err.message || 'Save failed.');
        }
        setSaving(false);
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Delete lesson "${title}"? This cannot be undone.`)) return;
        dispatch(deleteLesson(id));
    };

    /* ── helpers ── */
    const typeStyle = (type) => TYPE_META[type] || TYPE_META.text;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">

                {/* Topbar */}
                <div className="topbar">
                    <h1 className="topbar__title">Lesson manager</h1>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        {/* Filter by course */}
                        <select
                            className="form-input"
                            style={{ width: 200, padding: '7px 12px' }}
                            value={filterCourse}
                            onChange={(e) => setFilterCourse(e.target.value)}
                        >
                            <option value="">All my courses</option>
                            {myCourses.map((c) => (
                                <option key={c._id || c} value={c._id || c}>
                                    {c.title || c}
                                </option>
                            ))}
                        </select>
                        <button className="btn btn-primary" onClick={openNew}>
                            + Add lesson
                        </button>
                    </div>
                </div>

                {/* No subjects warning */}
                {myCourses.length === 0 && (
                    <div className="page-body">
                        <div className="alert alert-info">
                            ⚠ You have no subjects assigned yet. Ask an admin to assign subjects to you before creating lessons.
                        </div>
                    </div>
                )}

                {/* Lessons table */}
                <div className="page-body">
                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                        </div>
                    ) : lessons.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📚</div>
                            <p>No lessons yet.</p>
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openNew}>
                                + Add first lesson
                            </button>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th>Course</th>
                                    <th>Subject</th>
                                    <th>Order</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {lessons.map((lesson) => {
                                    const tm = typeStyle(lesson.type);
                                    return (
                                        <tr key={lesson._id}>
                                            <td style={{ fontWeight: 500 }}>{lesson.title}</td>
                                            <td>
                                                    <span style={{
                                                        fontSize: '0.75rem', fontWeight: 600,
                                                        padding: '2px 8px',
                                                        borderRadius: 'var(--radius-full)',
                                                        background: tm.color + '18',
                                                        color: tm.color,
                                                        textTransform: 'capitalize',
                                                    }}>
                                                        {tm.icon} {lesson.type}
                                                    </span>
                                            </td>
                                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                                                {lesson.course?.code || '—'}
                                            </td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>
                                                {lesson.subject?.name || '—'}
                                            </td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>{lesson.order}</td>
                                            <td>
                                                    <span className={`badge ${lesson.isPublished ? 'badge-success' : 'badge-error'}`}>
                                                        {lesson.isPublished ? 'Published' : 'Draft'}
                                                    </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(lesson)}>Edit</button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lesson._id, lesson.title)}>Delete</button>
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

            {/* ══ LESSON FORM MODAL ══ */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div
                        className="modal"
                        style={{ maxWidth: 760, maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal__header">
                            <h2 className="modal__title">
                                {editLesson ? `Edit — ${editLesson.title}` : 'New lesson'}
                            </h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
                        </div>

                        {formError && (
                            <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                                {formError}
                            </div>
                        )}
                        {lessonError && !formError && (
                            <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                                {lessonError}
                            </div>
                        )}

                        <form className="modal__body" onSubmit={handleSave}>

                            {/* ── Row 1: Title + Type ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Lesson title *</label>
                                    <input
                                        className="form-input"
                                        name="title"
                                        value={form.title}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. Introduction to Variables"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Lesson type</label>
                                    <select className="form-input" name="type" value={form.type} onChange={handleChange}>
                                        {Object.entries(TYPE_META).map(([key, meta]) => (
                                            <option key={key} value={key}>
                                                {meta.icon} {meta.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        {typeStyle(form.type).desc}
                                    </p>
                                </div>
                            </div>

                            {/* ── Row 2: Course → Subject (cascading) ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Course *</label>
                                    <select
                                        className="form-input"
                                        name="course"
                                        value={form.course}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select your course</option>
                                        {myCourses.map((c) => (
                                            <option key={c._id || c} value={c._id || c}>
                                                {c.title || c}
                                            </option>
                                        ))}
                                    </select>
                                    {myCourses.length === 0 && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: 4 }}>
                                            No courses found. Ask admin to assign subjects to you.
                                        </p>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subject *</label>
                                    <select
                                        className="form-input"
                                        name="subject"
                                        value={form.subject}
                                        onChange={handleChange}
                                        required
                                        disabled={!form.course}
                                    >
                                        <option value="">
                                            {form.course ? 'Select subject' : 'Select course first'}
                                        </option>
                                        {filteredSubjects.map((s) => (
                                            <option key={s._id} value={s._id}>
                                                {s.name} ({s.code})
                                            </option>
                                        ))}
                                    </select>
                                    {form.course && filteredSubjects.length === 0 && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: 4 }}>
                                            No subjects assigned to you for this course.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* ── Row 3: Duration + Order ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Duration (minutes)</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        name="duration"
                                        value={form.duration}
                                        onChange={handleChange}
                                        min={0}
                                        placeholder="e.g. 30"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Order / position</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        name="order"
                                        value={form.order}
                                        onChange={handleChange}
                                        min={0}
                                        placeholder="0 = first"
                                    />
                                </div>
                            </div>

                            {/* ══ CONTENT SECTION ══ */}
                            <div style={{
                                border: '1.5px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                overflow: 'hidden',
                                marginBottom: 'var(--space-md)',
                            }}>
                                {/* Section header */}
                                <div style={{
                                    background: 'var(--color-bg)',
                                    padding: 'var(--space-md) var(--space-lg)',
                                    borderBottom: '1px solid var(--color-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-sm)',
                                }}>
                                    <span style={{ fontSize: '1rem' }}>📝</span>
                                    <div>
                                        <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Lesson content</p>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                            You can add multiple content types at once — text notes, a file upload, and an external link all together.
                                        </p>
                                    </div>
                                </div>

                                <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

                                    {/* ── Text body (always shown) ── */}
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>📄</span> Text / notes
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                                                — optional
                                            </span>
                                        </label>
                                        <textarea
                                            className="form-input"
                                            name="content"
                                            value={form.content}
                                            onChange={handleChange}
                                            rows={6}
                                            placeholder="Write lesson notes, explanations, or HTML here…"
                                            style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                                        />
                                    </div>

                                    {/* Divider */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>AND / OR</span>
                                        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                    </div>

                                    {/* ── File upload ── */}
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>📎</span> Upload file
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                                                — PDF, video, slide, image, etc.
                                            </span>
                                        </label>

                                        {form.fileUrl ? (
                                                /* File already uploaded */
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-md)',
                                                    padding: 'var(--space-md)',
                                                    background: '#ECFDF5',
                                                    border: '1.5px solid #A7F3D0',
                                                    borderRadius: 'var(--radius-md)',
                                                }}>
                                                    <span style={{ fontSize: '1.25rem' }}>✅</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#059669' }}>
                                                            {uploadedFileName || 'File uploaded'}
                                                        </p>
                                                    <a
                                                        href={form.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ fontSize: '0.75rem', color: '#059669' }}
                                                        >
                                                        Preview file ↗
                                                    </a>
                                                </div>
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm"
                                                onClick={clearFile}
                                            >
                                                Remove
                                            </button>
                                            </div>
                                            ) : (
                                            /* Upload dropzone */
                                            <label style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 'var(--space-sm)',
                                            padding: 'var(--space-xl)',
                                            border: '2px dashed var(--color-border)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: uploadingFile ? 'not-allowed' : 'pointer',
                                            background: uploadingFile ? 'var(--color-bg)' : 'var(--color-surface)',
                                            transition: 'border-color var(--transition-fast)',
                                        }}
                                         onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                         onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                    >
                                        {uploadingFile ? (
                                            <>
                                                <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Uploading…</span>
                                            </>
                                        ) : (
                                            <>
                                                <span style={{ fontSize: '2rem' }}>☁</span>
                                                <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                            Click to upload a file
                                                        </span>
                                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                            PDF, MP4, PPTX, DOCX, JPG, PNG — any file type
                                                        </span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept="*/*"
                                            style={{ display: 'none' }}
                                            onChange={handleFileUpload}
                                            disabled={uploadingFile}
                                        />
                                    </label>
                                    )}

                                    {uploadError && (
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-error)', marginTop: 6 }}>
                                            {uploadError}
                                        </p>
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>AND / OR</span>
                                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                </div>

                                {/* ── External URL ── */}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span>🔗</span> External URL
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                                                — YouTube, Google Drive, website, etc.
                                            </span>
                                    </label>
                                    <input
                                        className="form-input"
                                        name="externalUrl"
                                        value={form.externalUrl}
                                        onChange={handleChange}
                                        placeholder="https://youtube.com/watch?v=… or any URL"
                                    />
                                </div>

                            </div>
                    </div>

                    {/* ── Publish toggle ── */}
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-sm)',
                        cursor: 'pointer',
                        padding: 'var(--space-md)',
                        background: form.isPublished ? '#ECFDF5' : 'var(--color-bg)',
                        border: `1.5px solid ${form.isPublished ? '#A7F3D0' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        transition: 'all var(--transition-fast)',
                        userSelect: 'none',
                    }}>
                        <input
                            type="checkbox"
                            name="isPublished"
                            checked={form.isPublished}
                            onChange={handleChange}
                            style={{ width: 16, height: 16 }}
                        />
                        <div>
                            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: form.isPublished ? '#059669' : 'var(--color-text-primary)' }}>
                                {form.isPublished ? '✓ Published — students can see this lesson' : 'Save as draft — not visible to students yet'}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                You can publish or unpublish at any time.
                            </p>
                        </div>
                    </label>

                    {/* Footer */}
                    <div className="modal__footer">
                        <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving || uploadingFile}>
                            {saving
                                ? <><span className="spinner"></span> Saving…</>
                                : editLesson ? 'Update lesson' : 'Create lesson'
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