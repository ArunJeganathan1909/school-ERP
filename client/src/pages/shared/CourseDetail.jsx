import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCourse } from '../../store/slices/courseSlice';
import { enrollCourse } from '../../store/slices/enrollmentSlice';
import Sidebar from '../../components/Sidebar';

export default function CourseDetail() {
    const { id } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { current: course, loading } = useSelector((s) => s.courses);
    const { list: enrollments, error: enrollError } = useSelector((s) => s.enrollments);
    const { user } = useSelector((s) => s.auth);

    const isEnrolled = enrollments.some(
        (e) => e.course?._id === id && e.status === 'active'
    );

    useEffect(() => {
        dispatch(fetchCourse(id));
    }, [dispatch, id]);

    const handleEnroll = async () => {
        const result = await dispatch(enrollCourse(id));
        if (enrollCourse.fulfilled.match(result)) {
            alert('Enrolled successfully!');
        }
    };

    if (loading) return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5', width: 32, height: 32, borderWidth: 3 }}></div>
            </div>
        </div>
    );

    if (!course) return null;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
                        <h1 className="topbar__title">{course.title}</h1>
                    </div>
                </div>

                <div className="page-body">
                    {/* Course hero */}
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                  <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.8rem', padding: '3px 12px', borderRadius: 'var(--radius-full)', letterSpacing: '0.05em' }}>
                    {course.code}
                  </span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: course.status === 'active' ? '#ECFDF5' : '#F9FAFB', color: course.status === 'active' ? '#059669' : '#6B7280', textTransform: 'capitalize' }}>
                    {course.status}
                  </span>
                                </div>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>{course.title}</h2>
                                <p style={{ color: 'var(--color-text-secondary)' }}>{course.department}</p>
                            </div>

                            {user?.role === 'student' && course.status === 'active' && (
                                <div style={{ textAlign: 'right' }}>
                                    {isEnrolled ? (
                                        <div className="alert alert-success" style={{ display: 'inline-flex' }}>✓ Enrolled</div>
                                    ) : (
                                        <>
                                            {enrollError && <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginBottom: 'var(--space-sm)' }}>{enrollError}</p>}
                                            <button className="btn btn-primary" onClick={handleEnroll}>
                                                Enroll Now
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {course.description && (
                            <p style={{ marginTop: 'var(--space-lg)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                {course.description}
                            </p>
                        )}

                        {/* Meta info grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--color-border)' }}>
                            {[
                                { label: 'Instructor', value: course.teacher?.name || 'Unassigned' },
                                { label: 'Duration', value: course.duration || '—' },
                                { label: 'Enrolled', value: `${course.enrolledCount ?? 0} / ${course.maxStudents}` },
                            ].map((item) => (
                                <div key={item.label}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{item.label}</p>
                                    <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Subjects — fetched separately in Phase 4 LMS */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Subjects</span>
                        </div>
                        <div className="empty-state">
                            <div className="empty-state__icon">📖</div>
                            <p>Subjects will appear here.</p>
                            <p>Full subject listing arrives in Phase 4 (LMS).</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}