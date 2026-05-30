import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createCourse, updateCourse } from '../../store/slices/courseSlice';

export default function CourseFormModal({ course, onClose }) {
    const dispatch = useDispatch();
    const { error } = useSelector((s) => s.courses);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        title:       '',
        code:        '',
        description: '',
        department:  '',
        duration:    '',
        maxStudents: 60,
        status:      'active',
    });

    // Pre-fill when editing
    useEffect(() => {
        if (course) {
            setForm({
                title:       course.title       || '',
                code:        course.code        || '',
                description: course.description || '',
                department:  course.department  || '',
                duration:    course.duration    || '',
                maxStudents: course.maxStudents || 60,
                status:      course.status      || 'active',
            });
        }
    }, [course]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        let result;
        if (course) {
            result = await dispatch(updateCourse({ id: course._id, data: form }));
        } else {
            result = await dispatch(createCourse(form));
        }

        setLoading(false);

        if (
            createCourse.fulfilled.match(result) ||
            updateCourse.fulfilled.match(result)
        ) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>

                <div className="modal__header">
                    <h2 className="modal__title">
                        {course ? 'Edit course' : 'Add course'}
                    </h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                {error && (
                    <div
                        className="alert alert-error"
                        style={{ margin: '0 var(--space-lg) var(--space-md)' }}
                    >
                        {error}
                    </div>
                )}

                <form className="modal__body" onSubmit={handleSubmit}>

                    {/* Title + Code */}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Course title *</label>
                            <input
                                className="form-input"
                                name="title"
                                value={form.title}
                                onChange={handleChange}
                                required
                                placeholder="e.g. Bachelor of Computer Science"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Course code *</label>
                            <input
                                className="form-input"
                                name="code"
                                value={form.code}
                                onChange={handleChange}
                                required
                                placeholder="e.g. BCS101"
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>
                    </div>

                    {/* Department + Duration */}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Department *</label>
                            <input
                                className="form-input"
                                name="department"
                                value={form.department}
                                onChange={handleChange}
                                required
                                placeholder="e.g. Science & Technology"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Duration</label>
                            <input
                                className="form-input"
                                name="duration"
                                value={form.duration}
                                onChange={handleChange}
                                placeholder="e.g. 3 years"
                            />
                        </div>
                    </div>

                    {/* Max students + Status */}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Max students</label>
                            <input
                                className="form-input"
                                type="number"
                                name="maxStudents"
                                value={form.maxStudents}
                                onChange={handleChange}
                                min={1}
                                max={500}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input"
                                name="status"
                                value={form.status}
                                onChange={handleChange}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="archived">Archived</option>
                            </select>
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
                            rows={3}
                            placeholder="Brief course description…"
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    {/* Info note */}
                    <div style={{
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)',
                        fontSize: '0.875rem',
                        color: '#2563EB',
                        display: 'flex',
                        gap: 'var(--space-sm)',
                        alignItems: 'flex-start',
                    }}>
                        <span style={{ flexShrink: 0 }}>ℹ</span>
                        <span>
              Teachers are assigned per subject, not per course.
              Go to <strong>Subjects</strong> to assign teachers to individual subjects.
            </span>
                    </div>

                    <div className="modal__footer">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading
                                ? <><span className="spinner"></span> Saving…</>
                                : course ? 'Update course' : 'Create course'
                            }
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}