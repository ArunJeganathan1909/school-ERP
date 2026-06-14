import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchLessons, fetchLesson } from '../../store/slices/lessonSlice';
import { fetchMyEnrollments } from '../../store/slices/enrollmentSlice';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import './LessonList.css';

/* ── constants ── */
const TYPE_META = {
    text:  { icon: '📄', color: '#4F46E5', bg: '#EEF2FF', label: 'Notes' },
    video: { icon: '🎬', color: '#7C3AED', bg: '#F5F3FF', label: 'Video' },
    pdf:   { icon: '📑', color: '#DC2626', bg: '#FEF2F2', label: 'PDF'   },
    link:  { icon: '🔗', color: '#059669', bg: '#ECFDF5', label: 'Link'  },
    slide: { icon: '📊', color: '#D97706', bg: '#FFFBEB', label: 'Slide' },
};

/* Banner colours + emojis that cycle across cards */
const CARD_THEMES = [
    { bg: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', emoji: '📘' },
    { bg: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)', emoji: '📗' },
    { bg: 'linear-gradient(135deg, #D97706 0%, #DC2626 100%)', emoji: '📙' },
    { bg: 'linear-gradient(135deg, #DB2777 0%, #9333EA 100%)', emoji: '📕' },
    { bg: 'linear-gradient(135deg, #0284C7 0%, #6366F1 100%)', emoji: '📓' },
    { bg: 'linear-gradient(135deg, #16A34A 0%, #CA8A04 100%)', emoji: '📒' },
];

/* ── YouTube helpers ── */
function isYouTube(url) { return /youtube\.com|youtu\.be/.test(url); }
function youTubeEmbedUrl(url) {
    try {
        const u   = new URL(url);
        const vid =
            u.searchParams.get('v') ||
            (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null) ||
            u.pathname.split('/').pop();
        return vid ? `https://www.youtube.com/embed/${vid}` : null;
    } catch { return null; }
}

/* ══════════════════════════════════════════
   LESSON CONTENT RENDERER
══════════════════════════════════════════ */
function LessonContent({ lesson }) {
    if (!lesson) return null;
    const { content, fileUrl, externalUrl } = lesson;
    const ext         = fileUrl ? fileUrl.split('?')[0].split('.').pop().toLowerCase() : '';
    const isVideoFile = ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
    const isPdfFile   = ext === 'pdf';
    const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    const hasContent  = content?.trim();
    const hasFile     = !!fileUrl;
    const hasLink     = !!externalUrl;

    if (!hasContent && !hasFile && !hasLink) return (
        <div className="ll-placeholder" style={{ minHeight: 200 }}>
            <div className="ll-placeholder__icon">📭</div>
            <p>No content has been added to this lesson yet.</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {hasContent && (
                <div className="ll-content-block">
                    <div className="ll-content-block__label"><span>📄</span> Lesson notes</div>
                    <div className="ll-content-block__body lesson-body"
                         dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}
                    />
                </div>
            )}

            {hasFile && (
                <div className="ll-content-block">
                    <div className="ll-content-block__label"><span>📎</span> Attached file</div>
                    <div className="ll-content-block__body">
                        {isVideoFile ? (
                            <video controls width="100%" src={fileUrl} style={{ borderRadius: 'var(--radius-md)', display: 'block' }}>
                                Your browser does not support video playback.
                            </video>
                        ) : isPdfFile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>
                                    📑 Open PDF in new tab ↗
                                </a>
                                <iframe src={fileUrl} width="100%" height="580px" title="PDF viewer"
                                        style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'block' }}
                                />
                            </div>
                        ) : isImageFile ? (
                            <img src={fileUrl} alt="Lesson attachment" style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)', display: 'block' }} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <span style={{ fontSize: '2rem' }}>📎</span>
                                <div>
                                    <p style={{ fontWeight: 600, marginBottom: 4 }}>Attached file</p>
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Download ↓</a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {hasLink && (
                <div className="ll-content-block">
                    <div className="ll-content-block__label"><span>🔗</span> External resource</div>
                    <div className="ll-content-block__body">
                        {isYouTube(externalUrl) ? (
                            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                <iframe src={youTubeEmbedUrl(externalUrl)} title="YouTube video"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                />
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                                <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open resource →</a>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>{externalUrl}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function LessonList() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const courseId = searchParams.get('course');
    const lessonId = searchParams.get('lesson');

    const { list: lessons, current: activeLesson, loading: lessonsLoading } = useSelector((s) => s.lessons);
    const { list: enrollments, loading: enrollmentsLoading }                = useSelector((s) => s.enrollments);

    const [lessonCounts, setLessonCounts]   = useState({});
    const [lessonLoading, setLessonLoading] = useState(false);

    /* 1. Load enrollments */
    useEffect(() => { dispatch(fetchMyEnrollments()); }, [dispatch]);

    /* 2. Fetch lesson count per enrolled course */
    useEffect(() => {
        const ids = enrollments
            .filter((e) => e.status === 'active' && e.course?._id)
            .map((e) => e.course._id);
        if (!ids.length) return;

        Promise.all(
            ids.map((id) =>
                api.get(`/lessons?course=${id}`)
                    .then(({ data }) => ({ id, count: (data.lessons || []).length }))
                    .catch(() => ({ id, count: 0 }))
            )
        ).then((res) => {
            const map = {};
            res.forEach(({ id, count }) => { map[id] = count; });
            setLessonCounts(map);
        });
    }, [enrollments]);

    /* 3. Load lessons when course selected */
    useEffect(() => {
        if (!courseId) return;
        dispatch(fetchLessons({ course: courseId }));
    }, [dispatch, courseId]);

    /* 4. Auto-select first lesson */
    useEffect(() => {
        if (!lessonId && lessons.length > 0 && courseId) {
            setSearchParams({ course: courseId, lesson: lessons[0]._id }, { replace: true });
        }
    }, [lessons, lessonId, courseId]);

    /* 5. Load lesson detail */
    useEffect(() => {
        if (!lessonId) return;
        setLessonLoading(true);
        dispatch(fetchLesson(lessonId)).finally(() => setLessonLoading(false));
    }, [dispatch, lessonId]);

    const selectCourse = (id) => setSearchParams({ course: id });
    const selectLesson = (id) => setSearchParams({ course: courseId, lesson: id });
    const goBack       = ()   => setSearchParams({});

    const enrolledCourses = enrollments
        .filter((e) => e.status === 'active' && e.course?._id)
        .map((e) => e.course);

    const selectedCourse = enrolledCourses.find((c) => c._id === courseId);
    const totalAvailable = Object.values(lessonCounts).reduce((a, b) => a + b, 0);

    /* ══ VIEW 1 — Course picker cards ══ */
    if (!courseId) {
        return (
            <div className="app-shell">
                <Sidebar />
                <div className="main-content">
                    <div className="topbar">
                        <h1 className="topbar__title">My Lessons</h1>
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                            {totalAvailable} lesson{totalAvailable !== 1 ? 's' : ''} available
                        </span>
                    </div>

                    <div className="page-body">
                        <div className="ll-page-header">
                            <h2>Choose a course to study</h2>
                            <p>Select any of your enrolled courses below to browse its lessons.</p>
                        </div>

                        {enrollmentsLoading ? (
                            <div className="empty-state">
                                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                            </div>
                        ) : enrolledCourses.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">📚</div>
                                <p>You are not enrolled in any active courses yet.</p>
                                <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => navigate('/courses')}>
                                    Browse courses
                                </button>
                            </div>
                        ) : (
                            <div className="ll-course-grid">
                                {enrolledCourses.map((course, i) => {
                                    const theme = CARD_THEMES[i % CARD_THEMES.length];
                                    const count = lessonCounts[course._id];
                                    return (
                                        <button
                                            key={course._id}
                                            className="ll-course-card"
                                            onClick={() => selectCourse(course._id)}
                                        >
                                            {/* Coloured banner */}
                                            <div className="ll-course-card__banner" style={{ background: theme.bg }}>
                                                <span className="ll-course-card__emoji">{theme.emoji}</span>
                                            </div>

                                            {/* Text body */}
                                            <div className="ll-course-card__body">
                                                <h3 className="ll-course-card__title">{course.title}</h3>
                                                <p className="ll-course-card__sub">
                                                    {course.code}{course.department ? ` · ${course.department}` : ''}
                                                </p>
                                            </div>

                                            {/* Footer */}
                                            <div className="ll-course-card__footer">
                                                <div>
                                                    {count !== undefined ? (
                                                        <>
                                                            <span className="ll-course-card__count">{count}</span>
                                                            <span className="ll-course-card__count-label">
                                                                {count === 1 ? 'lesson' : 'lessons'}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                                    )}
                                                </div>
                                                <span className="ll-course-card__cta">Start learning →</span>
                                            </div>
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

    /* ══ VIEW 2 — Split lesson viewer ══ */
    const tm = activeLesson ? (TYPE_META[activeLesson.type] || TYPE_META.text) : null;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={goBack}>← Courses</button>
                        <div>
                            <h1 className="topbar__title" style={{ lineHeight: 1.2 }}>{selectedCourse?.title || 'Lessons'}</h1>
                            {selectedCourse?.code && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{selectedCourse.code}</p>
                            )}
                        </div>
                    </div>
                    {tm && (
                        <span className="ll-lesson-type-badge" style={{ background: tm.bg, color: tm.color }}>
                            {tm.icon} {tm.label}
                        </span>
                    )}
                </div>

                <div className="ll-split">
                    {/* ── Left: lesson list ── */}
                    <aside className="ll-sidebar">
                        <div className="ll-sidebar__header">
                            <div className="ll-sidebar__course-name">{selectedCourse?.code || 'Lessons'}</div>
                            <div className="ll-sidebar__count">
                                {lessonsLoading ? 'Loading…' : `${lessons.length} lesson${lessons.length !== 1 ? 's' : ''}`}
                            </div>
                        </div>
                        <div className="ll-sidebar__list">
                            {lessonsLoading ? (
                                <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5', margin: '0 auto' }} />
                                </div>
                            ) : lessons.length === 0 ? (
                                <p style={{ padding: 'var(--space-lg)', fontSize: '0.875rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                    No lessons published yet.
                                </p>
                            ) : (
                                lessons.map((l, idx) => {
                                    const ltm      = TYPE_META[l.type] || TYPE_META.text;
                                    const isActive = l._id === lessonId;
                                    return (
                                        <button
                                            key={l._id}
                                            className={`ll-lesson-item ${isActive ? 'active' : ''}`}
                                            onClick={() => selectLesson(l._id)}
                                        >
                                            <span className="ll-lesson-item__num">{idx + 1}</span>
                                            <span className="ll-lesson-item__icon" style={{ color: isActive ? ltm.color : undefined }}>{ltm.icon}</span>
                                            <div className="ll-lesson-item__body">
                                                <div className="ll-lesson-item__title">{l.title}</div>
                                                {l.duration > 0 && <div className="ll-lesson-item__dur">⏱ {l.duration} min</div>}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    {/* ── Right: lesson content ── */}
                    <div className="ll-content">
                        {!lessonId ? (
                            <div className="ll-placeholder">
                                <div className="ll-placeholder__icon">👈</div>
                                <p>Pick a lesson to get started</p>
                                <small>Select any lesson from the list on the left.</small>
                            </div>
                        ) : lessonLoading ? (
                            <div className="ll-placeholder">
                                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                <p>Loading lesson…</p>
                            </div>
                        ) : activeLesson ? (
                            <>
                                <div className="ll-lesson-header">
                                    <div className="ll-lesson-breadcrumb">
                                        <span>{selectedCourse?.title}</span>
                                        <span>›</span>
                                        <span>{activeLesson.subject?.name || 'General'}</span>
                                    </div>
                                    <h2 className="ll-lesson-title">{activeLesson.title}</h2>
                                    <div className="ll-lesson-meta">
                                        {tm && (
                                            <span className="ll-lesson-type-badge" style={{ background: tm.bg, color: tm.color }}>
                                                {tm.icon} {tm.label}
                                            </span>
                                        )}
                                        {activeLesson.subject?.name && (
                                            <div className="ll-lesson-meta-item"><span>📖</span><span>{activeLesson.subject.name}</span></div>
                                        )}
                                        {activeLesson.duration > 0 && (
                                            <div className="ll-lesson-meta-item"><span>⏱</span><span>{activeLesson.duration} min</span></div>
                                        )}
                                        {activeLesson.teacher?.name && (
                                            <div className="ll-lesson-meta-item"><span>👩‍🏫</span><span>{activeLesson.teacher.name}</span></div>
                                        )}
                                    </div>
                                </div>

                                <div className="ll-lesson-body">
                                    <LessonContent lesson={activeLesson} />
                                </div>

                                {/* Prev / Next */}
                                {lessons.length > 1 && (() => {
                                    const idx  = lessons.findIndex((l) => l._id === lessonId);
                                    const prev = lessons[idx - 1];
                                    const next = lessons[idx + 1];
                                    return (
                                        <div className="ll-content-nav">
                                            <div>
                                                {prev && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => selectLesson(prev._id)}>
                                                        ← {prev.title.length > 30 ? prev.title.slice(0, 30) + '…' : prev.title}
                                                    </button>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                {idx + 1} / {lessons.length}
                                            </span>
                                            <div>
                                                {next && (
                                                    <button className="btn btn-primary btn-sm" onClick={() => selectLesson(next._id)}>
                                                        {next.title.length > 30 ? next.title.slice(0, 30) + '…' : next.title} →
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        ) : (
                            <div className="ll-placeholder">
                                <div className="ll-placeholder__icon">📄</div>
                                <p>Lesson not found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}