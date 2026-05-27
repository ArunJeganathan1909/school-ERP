import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLesson, fetchLessons } from '../../store/slices/lessonSlice';
import Sidebar from '../../components/Sidebar';
import './LessonViewer.css';

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
                    {/* Sidebar: lesson list */}
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

                    {/* Main content */}
                    <div className="lesson-content">
                        {loading ? (
                            <div className="empty-state">
                                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
                            </div>
                        ) : lesson ? (
                            <>
                                <div className="lesson-meta">
                                    <span>{lesson.subject?.name}</span>
                                    {lesson.duration > 0 && <span>⏱ {lesson.duration} min</span>}
                                    <span>By {lesson.teacher?.name}</span>
                                </div>

                                {lesson.type === 'text' && (
                                    <div className="lesson-body" dangerouslySetInnerHTML={{ __html: lesson.content.replace(/\n/g, '<br/>') }} />
                                )}

                                {lesson.type === 'video' && lesson.fileUrl && (
                                    <div className="lesson-video">
                                        <video controls width="100%" src={lesson.fileUrl}>
                                            Your browser does not support video playback.
                                        </video>
                                    </div>
                                )}

                                {lesson.type === 'link' && lesson.externalUrl && (
                                    <div className="lesson-link-block">
                                        <p>External resource:</p>
                                        <a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                            Open resource →
                                        </a>
                                    </div>
                                )}

                                {lesson.type === 'pdf' && lesson.fileUrl && (
                                    <div className="lesson-pdf">
                                        <a href={lesson.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                                            📑 Open PDF
                                        </a>
                                        <iframe src={lesson.fileUrl} width="100%" height="600px" title="PDF viewer" style={{ marginTop: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }} />
                                    </div>
                                )}
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