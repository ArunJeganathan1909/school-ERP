import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import { fetchCourses, deleteCourse, clearCourseError } from '../../store/slices/courseSlice';
import CourseFormModal from './CourseFormModal';
import './ManageCourses.css';

export default function ManageCourses() {
    const dispatch = useDispatch();
    const { list: courses, loading, total } = useSelector((s) => s.courses);
    const [showModal, setShowModal] = useState(false);
    const [editCourse, setEditCourse] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        dispatch(fetchCourses({ limit: 50, page: 1 }));
    }, [dispatch]);

    const handleEdit = (course) => {
        dispatch(clearCourseError());
        setEditCourse(course);
        setShowModal(true);
    };
    const handleAdd = () => {
        dispatch(clearCourseError());
        setEditCourse(null);
        setShowModal(true);
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
        setDeletingId(id);
        await dispatch(deleteCourse(id));
        setDeletingId(null);
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Manage Courses</h1>
                    <button className="btn btn-primary" onClick={handleAdd}>+ Add Course</button>
                </div>

                <div className="page-body">
                    {/* Stats bar */}
                    <div className="manage-courses__stats">
                        <span>Total: <strong>{total}</strong></span>
                        <span>Active: <strong>{courses.filter(c => c.status === 'active').length}</strong></span>
                        <span>Inactive: <strong>{courses.filter(c => c.status === 'inactive').length}</strong></span>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="course-list__loading">
                            <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
                            <span>Loading…</span>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Title</th>
                                    <th>Department</th>
                                    <th>Teacher</th>
                                    <th>Enrolled</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {courses.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
                                            No courses yet. Add your first course.
                                        </td>
                                    </tr>
                                ) : courses.map((course) => (
                                    <tr key={course._id}>
                                        <td>
                        <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                          {course.code}
                        </span>
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{course.title}</td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{course.department}</td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{course.teacher?.name || '—'}</td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{course.enrolledCount ?? 0} / {course.maxStudents}</td>
                                        <td>
                        <span className={`badge badge-${course.status === 'active' ? 'success' : 'error'}`}>
                          {course.status}
                        </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                                <button className="btn btn-outline btn-sm" onClick={() => handleEdit(course)}>Edit</button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleDelete(course._id, course.title)}
                                                    disabled={deletingId === course._id}
                                                >
                                                    {deletingId === course._id ? '…' : 'Delete'}
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

            {showModal && (
                <CourseFormModal
                    course={editCourse}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}