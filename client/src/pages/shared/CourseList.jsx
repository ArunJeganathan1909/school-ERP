import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchCourses } from '../../store/slices/courseSlice';
import './CourseList.css';

export default function CourseList() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { list: courses, loading, total, pages } = useSelector((s) => s.courses);
    const { user } = useSelector((s) => s.auth);

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('active');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const params = { page, limit: 12 };
        if (status) params.status = status;
        if (search) params.search = search;
        dispatch(fetchCourses(params));
    }, [dispatch, page, status]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        const params = { page: 1, limit: 12 };
        if (status) params.status = status;
        if (search) params.search = search;
        dispatch(fetchCourses(params));
    };

    return (
        <div className="course-list-page">
            {/* Header */}
            <div className="course-list__header">
                <div>
                    <h2 className="course-list__title">Courses</h2>
                    <p className="course-list__sub">{total} course{total !== 1 ? 's' : ''} available</p>
                </div>
                {user?.role === 'admin' && (
                    <button className="btn btn-primary" onClick={() => navigate('/admin/courses')}>
                        + Manage Courses
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="course-list__filters">
                <form className="course-list__search" onSubmit={handleSearch}>
                    <input
                        className="form-input"
                        type="text"
                        placeholder="Search courses…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-sm">Search</button>
                </form>

                <div className="course-list__status-tabs">
                    {['active', 'inactive', ''].map((s) => (
                        <button
                            key={s || 'all'}
                            className={`course-status-tab ${status === s ? 'active' : ''}`}
                            onClick={() => { setStatus(s); setPage(1); }}
                        >
                            {s || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="course-list__loading">
                    <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
                    <span>Loading courses…</span>
                </div>
            ) : courses.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">📚</div>
                    <p>No courses found.</p>
                </div>
            ) : (
                <div className="course-grid">
                    {courses.map((course) => (
                        <CourseCard
                            key={course._id}
                            course={course}
                            onClick={() => navigate(`/courses/${course._id}`)}
                        />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
                <div className="course-list__pagination">
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        ← Prev
                    </button>
                    <span className="pagination__info">Page {page} of {pages}</span>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        disabled={page === pages}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

function CourseCard({ course, onClick }) {
    const statusColors = {
        active:   { bg: '#ECFDF5', color: '#059669' },
        inactive: { bg: '#F9FAFB', color: '#6B7280' },
        archived: { bg: '#FEF2F2', color: '#DC2626' },
    };
    const sc = statusColors[course.status] || statusColors.inactive;

    return (
        <div className="course-card" onClick={onClick}>
            <div className="course-card__top">
                <div className="course-card__code">{course.code}</div>
                <span
                    className="course-card__status"
                    style={{ background: sc.bg, color: sc.color }}
                >
          {course.status}
        </span>
            </div>

            <h3 className="course-card__title">{course.title}</h3>
            <p className="course-card__dept">{course.department}</p>

            {course.description && (
                <p className="course-card__desc">
                    {course.description.slice(0, 90)}
                    {course.description.length > 90 ? '…' : ''}
                </p>
            )}

            <div className="course-card__footer">
        <span className="course-card__meta">
          ⏱ {course.duration || 'Flexible'}
        </span>
                <span className="course-card__meta">
          🎓 {course.enrolledCount ?? 0} / {course.maxStudents}
        </span>
            </div>
        </div>
    );
}