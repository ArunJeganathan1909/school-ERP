import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { fetchLessons, fetchLesson } from '../../store/slices/lessonSlice';
import { fetchMyEnrollments } from '../../store/slices/enrollmentSlice';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import './LessonList.css';
import './LessonViewer.css'; /* reuse .lesson-sidebar__item, .lesson-body, .lesson-meta etc */

/* ── helpers ── */
const TYPE_ICON = { text: '📄', video: '🎬', pdf: '📑', link: '🔗', slide: '📊' };

function isYouTube(url) {
    return /youtube\.com|youtu\.be/.test(url);
}
function youTubeEmbedUrl(url) {
    try {
        const u = new URL(url);
        const vid =
            u.searchParams.get('v') ||
            (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null) ||
            u.pathname.split('/').pop();
        return vid ? `https://www.youtube.com/embed/${vid}` : null;
    } catch { return null; }
}

/* ── inline lesson content renderer ── */
function LessonContent({ lesson }) {
    if (!lesson) return null;
    const { content, fileUrl, externalUrl } = lesson;
    const ext = fileUrl ? fileUrl.split('?')[0].split('.').pop().toLowerCase() : '';
    const isVideoFile = ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
    const isPdfFile   = ext === 'pdf';
    const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);

    return (
        <div>
            {content?.trim() && (
                <div
                    className="lesson-body"
                    style={{ marginBottom: (fileUrl || externalUrl) ? 'var(--space-xl)' : 0 }}
                    dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}
                />
            )}

            {fileUrl && (
                <div style={{ marginBottom: externalUrl ? 'var(--space-xl)' : 0 }}>
                    {isVideoFile ? (
                        <video controls width="100%" src={fileUrl} style={{ borderRadius: 'var(--radius-md)' }}>
                            Your browser does not support video playback.
                        </video>
                    ) : isPdfFile ? (
                        <div className="lesson-pdf">
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                                📑 Open PDF in new tab
                            </a>
                            <iframe
                                src={fileUrl}
                                width="100%"
                                height="560px"
                                title="PDF viewer"
                                style={{ marginTop: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                            />
                        </div>
                    ) : isImageFile ? (
                        <img src={fileUrl} alt="Lesson attachment" style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)' }} />
                    ) : (
                        <div className="lesson-link-block">
                            <p>📎 Attached file:</p>
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                                Download file ↓
                            </a>
                        </div>
                    )}
                </div>
            )}

            {externalUrl && (
                isYouTube(externalUrl) ? (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <iframe
                            src={youTubeEmbedUrl(externalUrl)}
                            title="YouTube video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        />
                    </div>
                ) : (
                    <div className="lesson-link-block">
                        <p>External resource:</p>
                        <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                            Open resource →
                        </a>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
                            {externalUrl}
                        </p>
                    </div>
                )
            )}

            {!content?.trim() && !fileUrl && !externalUrl && (
                <div className="empty-state" style={{ padding: 'var(--space-xl) 0' }}>
                    <div className="empty-state__icon">📭</div>
                    <p>No content has been added to this lesson yet.</p>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function LessonList() {
    const dispatch = useDispatch();
    const [searchParams, setSearchParams] = useSearchParams();
    const courseId = searchParams.get('course');
    const lessonId = searchParams.get('lesson');

    const { list: lessons, current: activeLesson, loading: lessonsLoading } = useSelector((s) => s.lessons);

    /* enrollments from Redux — same data MyCourses already uses */
    const { list: enrollments, loading: enrollmentsLoading } = useSelector((s) => s.enrollments);

    /* lesson counts per course { courseId: number } */
    const [lessonCounts, setLessonCounts]   = useState({});
    const [lessonLoading, setLessonLoading] = useState(false);

    /* ── 1. Load enrollments via Redux thunk (active only) ── */
    useEffect(() => {
        dispatch(fetchMyEnrollments());
    }, [dispatch]);

    /* ── 2. For each enrolled active course, fetch lesson count ── */
    useEffect(() => {
        const activeCourses = enrollments
            .filter((e) => e.status === 'active' && e.course?._id)
            .map((e) => e.course._id);

        if (activeCourses.length === 0) return;

        Promise.all(
            activeCourses.map((id) =>
                api.get(`/lessons?course=${id}`)
                    .then(({ data }) => ({ id, count: (data.lessons || []).length }))
                    .catch(() => ({ id, count: 0 }))
            )
        ).then((results) => {
            const counts = {};
            results.forEach(({ id, count }) => { counts[id] = count; });
            setLessonCounts(counts);
        });
    }, [enrollments]);

    /* ── 3. When a course is selected, load its lessons ── */
    useEffect(() => {
        if (!courseId) return;
        dispatch(fetchLessons({ course: courseId }));
    }, [dispatch, courseId]);

    /* ── 4. Auto-select first lesson when list loads ── */
    useEffect(() => {
        if (!lessonId && lessons.length > 0 && courseId) {
            setSearchParams({ course: courseId, lesson: lessons[0]._id }, { replace: true });
        }
    }, [lessons, lessonId, courseId]);

    /* ── 5. Load full lesson detail when lessonId changes ── */
    useEffect(() => {
        if (!lessonId) return;
        setLessonLoading(true);
        dispatch(fetchLesson(lessonId)).finally(() => setLessonLoading(false));
    }, [dispatch, lessonId]);

    const selectCourse = (id) => setSearchParams({ course: id });
    const selectLesson = (id) => setSearchParams({ course: courseId, lesson: id });
    const goBack       = ()   => setSearchParams({});

    /* derive active enrolled courses */
    const enrolledCourses = enrollments
        .filter((e) => e.status === 'active' && e.course?._id)
        .map((e) => e.course);

    /* ══ VIEW 1: Course picker ══ */
    if (!courseId) {
        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <h1 className="topbar__title">My Lessons</h1>
                    </div>
                    <div className="page-body">
                        {enrollmentsLoading ? (
                            <div className="empty-state">
                                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                            </div>
                        ) : enrolledCourses.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">📚</div>
                                <p>You are not enrolled in any active courses yet.</p>
                            </div>
                        ) : (
                            <div className="ll-course-grid">
                                {enrolledCourses.map((course) => {
                                    const count = lessonCounts[course._id];
                                    return (
                                        <button
                                            key={course._id}
                                            className="ll-course-card"
                                            onClick={() => selectCourse(course._id)}
                                        >
                                            <div className="ll-course-card__icon">📘</div>
                                            <div className="ll-course-card__body">
                                                <h3 className="ll-course-card__title">{course.title}</h3>
                                                <p className="ll-course-card__sub">{course.code} · {course.department}</p>
                                            </div>
                                            {count !== undefined && (
                                                <div className="ll-course-card__meta">
                                                    {count} {count === 1 ? 'lesson' : 'lessons'}
                                                </div>
                                            )}
                                            <div className="ll-course-card__arrow">→</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /* ══ VIEW 2: Split lesson viewer ══ */
    const selectedCourse = enrolledCourses.find((c) => c._id === courseId);

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={goBack}>← Courses</button>
                        <h1 className="topbar__title">{selectedCourse?.title || 'Lessons'}</h1>
                    </div>
                    {activeLesson && (
                        <span className="badge badge-student" style={{ textTransform: 'capitalize' }}>
                            {TYPE_ICON[activeLesson.type]} {activeLesson.type}
                        </span>
                    )}
                </div>

                <div className="ll-split">

                    {/* ── Left: lesson list ── */}
                    <aside className="ll-sidebar">
                        <div className="lesson-sidebar__title">
                            All lessons
                            {lessons.length > 0 && (
                                <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--color-text-muted)' }}>
                                    ({lessons.length})
                                </span>
                            )}
                        </div>

                        {lessonsLoading ? (
                            <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5', margin: '0 auto' }} />
                            </div>
                        ) : lessons.length === 0 ? (
                            <p style={{ padding: 'var(--space-md)', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                No lessons published yet.
                            </p>
                        ) : (
                            lessons.map((l) => (
                                <button
                                    key={l._id}
                                    className={`lesson-sidebar__item ${l._id === lessonId ? 'active' : ''}`}
                                    onClick={() => selectLesson(l._id)}
                                >
                                    <span className="lesson-sidebar__icon">{TYPE_ICON[l.type]}</span>
                                    <span className="lesson-sidebar__name">{l.title}</span>
                                    {l.duration > 0 && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                            {l.duration}m
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </aside>

                    {/* ── Right: lesson content ── */}
                    <div className="ll-content">
                        {!lessonId ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">👈</div>
                                <p>Select a lesson from the list to get started.</p>
                            </div>
                        ) : lessonLoading ? (
                            <div className="empty-state">
                                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                            </div>
                        ) : activeLesson ? (
                            <>
                                <div className="ll-lesson-header">
                                    <h2 className="ll-lesson-title">{activeLesson.title}</h2>
                                    <div className="lesson-meta" style={{ marginBottom: 0, paddingBottom: 0, border: 'none' }}>
                                        <span>{activeLesson.subject?.name}</span>
                                        {activeLesson.duration > 0 && <span>⏱ {activeLesson.duration} min</span>}
                                        <span>By {activeLesson.teacher?.name}</span>
                                    </div>
                                </div>
                                <div className="ll-lesson-body">
                                    <LessonContent lesson={activeLesson} />
                                </div>
                            </>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state__icon">📄</div>
                                <p>Lesson not found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}