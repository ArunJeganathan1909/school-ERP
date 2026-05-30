import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createCourse, updateCourse } from '../../store/slices/courseSlice';
import api from '../../api/axios';

export default function CourseFormModal({ course, onClose }) {
    const dispatch = useDispatch();
    const { error } = useSelector((s) => s.courses);

    const [loading, setLoading] = useState(false);
    const [teachers, setTeachers] = useState([]);

    const [form, setForm] = useState({
        title: '',
        code: '',
        description: '',
        department: '',
        duration: '',
        maxStudents: 60,
        status: 'active',
        teacher: '',
    });

    useEffect(() => {
        if (course) {
            setForm({
                title: course.title || '',
                code: course.code || '',
                description: course.description || '',
                department: course.department || '',
                duration: course.duration || '',
                maxStudents: course.maxStudents || 60,
                status: course.status || 'active',
                teacher: course.teacher?._id || course.teacher || '',
            });
        }
    }, [course]);

    useEffect(() => {
        api.get('/users?role=teacher&limit=100')
            .then(({ data }) => setTeachers(data.users || []))
            .catch(() => setTeachers([]));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            ...form,
            teacher: form.teacher || null,
        };

        let result;
        if (course) {
            result = await dispatch(updateCourse({ id: course._id, data: payload }));
        } else {
            result = await dispatch(createCourse(payload));
        }

        setLoading(false);
        if (createCourse.fulfilled.match(result) || updateCourse.fulfilled.match(result)) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h2 className="modal__title">
                        {course ? 'Edit Course' : 'Add Course'}
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
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Course title *</label>
                            <input
                                className="form-input"
                                name="title"
                                value={form.title}
                                onChange={handleChange}
                                required
                                placeholder="e.g. Computer Science"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Course code *</label>
                            <input
                                className="form-input"
                                name="code" value={form.code}
                                onChange={handleChange}
                                required
                                placeholder="e.g. CS101"
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>
                    </div>

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

                    <div className="form-group">
                        <label className="form-label">Assign teacher</label>
                        <select
                            className="form-input"
                            name="teacher"
                            value={form.teacher}
                            onChange={handleChange}
                        >
                            <option value="">- No teacher assigned -</option>
                            {teachers.map((t) => (
                                <option key={t._id} value={t._id}>
                                    {t.name} ({t.email})
                                </option>
                            ))}
                        </select>
                        {teachers.length === 0 && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                No teachers found. Register teacher accounts first.
                            </p>
                        )}
                    </div>

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

                    <div className="modal__footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <><span className="spinner"></span> Saving…</> : course ? 'Update Course' : 'Create Course'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}