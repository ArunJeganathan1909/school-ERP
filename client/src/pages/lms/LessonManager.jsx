import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import {
    fetchLessons,
    createLesson,
    updateLesson,
    deleteLesson,
} from '../../store/slices/lessonSlice';
import { fetchMyTeaching } from '../../store/slices/subjectTeacherAssignmentSlice';
import { uploadLessonFile } from '../../utils/supabase';

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
    content:     '',
    externalUrl: '',
    fileUrl:     '',
    duration:    0,
    isPublished: false,
    subject:     '',   // required
    section:     '',   // optional — pin to one section, or leave blank to share across all
    order:       0,
};

/* ─────────────────── component ─────────────────── */
export default function LessonManager() {
    const dispatch = useDispatch();
    const { list: lessons, loading, error: lessonError } = useSelector((s) => s.lessons);
    const { myTeaching, loading: teachingLoading } = useSelector((s) => s.subjectTeacherAssignments);

    /* derive unique subjects + their sections from myTeaching */
    const [mySubjects,       setMySubjects]       = useState([]); // [{ subject, sections: [...] }]
    const [filterSubject,    setFilterSubject]    = useState('');

    /* modal */
    const [showForm,   setShowForm]   = useState(false);
    const [editLesson, setEditLesson] = useState(null);
    const [form,       setForm]       = useState(EMPTY_FORM);

    /* file upload state */
    const [uploadingFile,    setUploadingFile]    = useState(false);
    const [uploadError,      setUploadError]      = useState('');
    const [uploadedFileName, setUploadedFileName] = useState('');

    const [saving,    setSaving]    = useState(false);
    const [formError, setFormError] = useState('');

    /* ── load teacher's subject+section assignments ── */
    useEffect(() => {
        dispatch(fetchMyTeaching());
    }, [dispatch]);

    /* ── group assignments by subject ── */
    useEffect(() => {
        const grouped = {};
        myTeaching.forEach((a) => {
            const sid = a.subject?._id;
            if (!sid) return;
            if (!grouped[sid]) grouped[sid] = { subject: a.subject, sections: [] };
            grouped[sid].sections.push(a.section);
        });
        setMySubjects(Object.values(grouped));
    }, [myTeaching]);

    /* ── load lessons (filtered by subject) ── */
    useEffect(() => {
        const params = {};
        if (filterSubject) params.subject = filterSubject;
        dispatch(fetchLessons(params));
    }, [dispatch, filterSubject]);

    /* sections available for whichever subject is selected in the form */
    const sectionsForFormSubject = form.subject
        ? mySubjects.find((g) => g.subject?._id === form.subject)?.sections || []
        : [];

    /* ── handlers ── */
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    // Reset section when subject changes (sections list differs per subject)
    const handleSubjectChange = (e) => {
        setForm((f) => ({ ...f, subject: e.target.value, section: '' }));
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
        setForm({ ...EMPTY_FORM, subject: filterSubject || '' });
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
            subject:     lesson.subject?._id || lesson.subject || '',
            section:     lesson.section?._id || lesson.section || '',
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

        if (!form.subject)      return setFormError('Please select a subject.');
        if (!form.title.trim()) return setFormError('Title is required.');

        if (!form.content.trim() && !form.externalUrl.trim() && !form.fileUrl) {
            return setFormError('Add at least one content source — text, a URL, or an uploaded file.');
        }

        setSaving(true);
        const payload = { ...form, section: form.section || null };

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

    const sectionLabel = (sec) =>
        sec ? `${sec.grade?.gradeNumber ?? ''}${sec.name}${sec.grade?.stream && sec.grade.stream !== 'none' ? ` (${sec.grade.stream})` : ''}` : '—';

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">

                {/* Topbar */}
                <div className="topbar">
                    <h1 className="topbar__title">Lesson manager</h1>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        {/* Filter by subject */}
                        <select
                            className="form-input"
                            style={{ width: 220, padding: '7px 12px' }}
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                        >
                            <option value="">All my subjects</option>
                            {mySubjects.map(({ subject }) => (
                                <option key={subject._id} value={subject._id}>
                                    {subject.name} ({subject.code})
                                </option>
                            ))}
                        </select>
                        <button className="btn btn-primary" onClick={openNew} disabled={mySubjects.length === 0}>
                            + Add lesson
                        </button>
                    </div>
                </div>

                {/* No subjects warning */}
                {!teachingLoading && mySubjects.length === 0 && (
                    <div className="page-body">
                        <div className="alert alert-info">
                            ⚠ You haven't been assigned to teach any subject yet. Ask an admin to assign you to a section.
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
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={openNew} disabled={mySubjects.length === 0}>
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
                                    <th>Subject</th>
                                    <th>Section</th>
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
                                            <td style={{ color: 'var(--color-text-secondary)' }}>
                                                {lesson.subject?.name || '—'}
                                            </td>
                                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                                                {lesson.section ? sectionLabel(lesson.section) : <span style={{ color: 'var(--color-text-muted)' }}>All sections</span>}
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

                            {/* ── Row 2: Subject → Section (cascading) ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Subject *</label>
                                    <select
                                        className="form-input"
                                        name="subject"
                                        value={form.subject}
                                        onChange={handleSubjectChange}
                                        required
                                    >
                                        <option value="">Select your subject</option>
                                        {mySubjects.map(({ subject }) => (
                                            <option key={subject._id} value={subject._id}>
                                                {subject.name} ({subject.code})
                                            </option>
                                        ))}
                                    </select>
                                    {mySubjects.length === 0 && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: 4 }}>
                                            No subjects assigned to you yet.
                                        </p>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Section <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
                                    </label>
                                    <select
                                        className="form-input"
                                        name="section"
                                        value={form.section}
                                        onChange={handleChange}
                                        disabled={!form.subject}
                                    >
                                        <option value="">All my sections for this subject</option>
                                        {sectionsForFormSubject.map((sec) => (
                                            <option key={sec._id} value={sec._id}>
                                                {sectionLabel(sec)}
                                            </option>
                                        ))}
                                    </select>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        Leave blank to share this lesson with every section you teach for this subject.
                                    </p>
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
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Order</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        name="order"
                                        value={form.order}
                                        onChange={handleChange}
                                        min={0}
                                    />
                                </div>
                            </div>

                            {/* ── Content source block ── */}
                            <div className="form-group">
                                <label className="form-label">Lesson content</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

                                    {/* Text content */}
                                    <textarea
                                        className="form-input"
                                        name="content"
                                        value={form.content}
                                        onChange={handleChange}
                                        rows={5}
                                        placeholder="Write lesson notes, instructions, or any text content here…"
                                        style={{ resize: 'vertical' }}
                                    />

                                    {/* File upload */}
                                    <div>
                                        {form.fileUrl ? (
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
                                            <button type="button" className="btn btn-danger btn-sm" onClick={clearFile}>
                                                Remove
                                            </button>
                                            </div>
                                            ) : (
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

                                {/* External URL */}
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