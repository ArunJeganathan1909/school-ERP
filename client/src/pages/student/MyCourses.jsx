import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { fetchMyEnrollments } from '../../store/slices/enrollmentSlice';

export default function MyCourses() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { list: enrollments, loading } = useSelector((s) => s.enrollments);

    useEffect(() => {
        dispatch(fetchMyEnrollments());
    }, [dispatch]);

    const statusStyle = {
        active:    { bg: '#ECFDF5', color: '#059669' },
        dropped:   { bg: '#FEF2F2', color: '#DC2626' },
        completed: { bg: '#EFF6FF', color: '#2563EB' },
        pending:   { bg: '#FFFBEB', color: '#D97706' },
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">My Courses</h1>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate('/courses')}>
                        Browse Courses
                    </button>
                </div>

                <div className="page-body">
                    {loading ? (
                        <div className="course-list__loading">
                            <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
                        </div>
                    ) : enrollments.length === 0 ? (
                        <div className="empty-state" style={{ paddingTop: 'var(--space-2xl)' }}>
                            <div className="empty-state__icon">📚</div>
                            <p>You haven't enrolled in any courses yet.</p>
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => navigate('/courses')}>
                                Browse Courses
                            </button>
                        </div>
                    ) : (
                        <div className="course-grid">
                            {enrollments.map((enrollment) => {
                                const course = enrollment.course;
                                const sc = statusStyle[enrollment.status] || statusStyle.active;
                                if (!course) return null;
                                return (
                                    <div
                                        key={enrollment._id}
                                        className="course-card"
                                        onClick={() => navigate(`/courses/${course._id}`)}
                                    >
                                        <div className="course-card__top">
                                            <span className="course-card__code">{course.code}</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
                        {enrollment.status}
                      </span>
                                        </div>
                                        <h3 className="course-card__title">{course.title}</h3>
                                        <p className="course-card__dept">{course.department}</p>
                                        <div className="course-card__footer">
                                          <span className="course-card__meta">
                                            ⏱ {course.duration || 'Flexible'}
                                          </span>
                                            {enrollment.grade && (
                                                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                                  Grade: {enrollment.grade}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}