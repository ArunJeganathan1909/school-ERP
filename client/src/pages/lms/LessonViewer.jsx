import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLesson, fetchLessons } from '../../store/slices/lessonSlice';
import Sidebar from '../../components/Sidebar';
import './LessonViewer.css';

/* ── helpers ── */
function isYouTube(url) {
    return /youtube\.com|youtu\.be/.test(url);
}

function youTubeEmbedUrl(url) {
    try {
        const u = new URL(url);
        const vid =
            u.searchParams.get('v') ||                       // youtube.com/watch?v=ID
            (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null) || // youtu.be/ID
            u.pathname.split('/').pop();                      // youtube.com/embed/ID
        return vid ? `https://www.youtube.com/embed/${vid}` : null;
    } catch {
        return null;
    }
}

export default function LessonViewer() {
    const { id } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { current: lesson, list: lessons, loading } = useSelector((s) => s.lessons);

    useEffect(() => {
        dispatch(fetchLesson(id));
    }, [dispatch, id]);

    useEffect(() => {
        if (lesson?.course?._id) {
            dispatch(fetchLessons({ course: lesson.course._id }));
        }
    }, [dispatch, lesson?.course?._id]);

    const typeIcon = { text: '📄', video: '🎬', pdf: '📑', link: '🔗', slide: '📊' };

    /* ── render content — type-aware but always shows fileUrl/externalUrl if present ── */
    function renderContent(lesson) {
        const { type, content, fileUrl, externalUrl } = lesson;

        // Detect file extension to pick the best renderer regardless of lesson type
        const ext = fileUrl ? fileUrl.split('?')[0].split('.').pop().toLowerCase() : '';
        const isVideoFile = ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
        const isPdfFile   = ext === 'pdf';

        return (
            <>
                {/* ── Text notes — always shown if content exists, for ANY type ── */}
                {content?.trim() && (
                    <div
                        className="lesson-body"
                        style={{ marginBottom: (fileUrl || externalUrl) ? 'var(--space-xl)' : 0 }}
                        dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}
                    />
                )}

                {/* ── Uploaded file — rendered based on actual file extension, not lesson type ── */}
                {fileUrl && (
                    <>
                        {isVideoFile ? (
                            <div className="lesson-video" style={{ marginBottom: externalUrl ? 'var(--space-xl)' : 0 }}>
                                <video controls width="100%" src={fileUrl} style={{ borderRadius: 'var(--radius-md)' }}>
                                    Your browser does not support video playback.
                                </video>
                            </div>
                        ) : isPdfFile ? (
                            <div className="lesson-pdf" style={{ marginBottom: externalUrl ? 'var(--space-xl)' : 0 }}>
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                                    📑 Open PDF in new tab
                                </a>
                                <iframe
                                    src={fileUrl}
                                    width="100%"
                                    height="600px"
                                    title="PDF viewer"
                                    style={{ marginTop: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                        ) : (
                            /* Any other file type — image preview or download button */
                            <div className="lesson-link-block" style={{ marginBottom: externalUrl ? 'var(--space-md)' : 0 }}>
                                {['jpg','jpeg','png','gif','webp','svg'].includes(ext) ? (
                                    <img src={fileUrl} alt="Lesson attachment" style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)' }} />
                                ) : (
                                    <>
                                        <p>📎 Attached file:</p>
                                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                                            Download file ↓
                                        </a>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ── External URL — always shown if present, for ANY type ── */}
                {externalUrl && (
                    <>
                        {isYouTube(externalUrl) ? (
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
                        )}
                    </>
                )}

                {/* ── Nothing at all ── */}
                {!content?.trim() && !fileUrl && !externalUrl && (
                    <div className="empty-state">
                        <div className="empty-state__icon">📭</div>
                        <p>No content has been added to this lesson yet.</p>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
                        <h1 className="topbar__title">{lesson?.title || 'Lesson'}</h1>
                    </div>
                    {lesson && (
                        <span className="badge badge-student" style={{ textTransform: 'capitalize' }}>
                            {typeIcon[lesson.type]} {lesson.type}
                        </span>
                    )}
                </div>

                <div className="lesson-layout">
                    {/* Lesson list sidebar */}
                    <aside className="lesson-sidebar">
                        <div className="lesson-sidebar__title">All lessons</div>
                        {lessons.map((l) => (
                            <button
                                key={l._id}
                                className={`lesson-sidebar__item ${l._id === id ? 'active' : ''}`}
                                onClick={() => navigate(`/lessons/${l._id}`)}
                            >
                                <span className="lesson-sidebar__icon">{typeIcon[l.type]}</span>
                                <span className="lesson-sidebar__name">{l.title}</span>
                                {!l.isPublished && <span className="lesson-sidebar__draft">Draft</span>}
                            </button>
                        ))}
                    </aside>

                    {/* Main content area */}
                    <div className="lesson-content">
                        {loading ? (
                            <div className="empty-state">
                                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                            </div>
                        ) : lesson ? (
                            <>
                                <div className="lesson-meta">
                                    <span>{lesson.subject?.name}</span>
                                    {lesson.duration > 0 && <span>⏱ {lesson.duration} min</span>}
                                    <span>By {lesson.teacher?.name}</span>
                                </div>
                                {renderContent(lesson)}
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