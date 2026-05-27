import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchQuiz, submitQuizAttempt, clearLastResult } from '../../store/slices/quizSlice';
import Sidebar from '../../components/Sidebar';
import './QuizPlayer.css';

export default function QuizPlayer() {
    const { id } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { current: quiz, lastResult, loading, error } = useSelector((s) => s.quizzes);

    const [started, setStarted] = useState(false);
    const [answers, setAnswers] = useState({});   // { questionId: { selectedOptionId?, textAnswer? } }
    const [timeLeft, setTimeLeft] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const startTime = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        dispatch(fetchQuiz(id));
        return () => { clearInterval(timerRef.current); dispatch(clearLastResult()); };
    }, [dispatch, id]);

    const handleStart = () => {
        setStarted(true);
        setTimeLeft((quiz.duration || 30) * 60);
        startTime.current = Date.now();
        timerRef.current = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0; }
                return t - 1;
            });
        }, 1000);
    };

    const handleAnswer = (questionId, value, type) => {
        setAnswers((prev) => ({
            ...prev,
            [questionId]: type === 'short' ? { textAnswer: value } : { selectedOptionId: value },
        }));
    };

    const handleSubmit = async () => {
        clearInterval(timerRef.current);
        const timeTaken = startTime.current ? Math.round((Date.now() - startTime.current) / 1000) : 0;
        const formattedAnswers = Object.entries(answers).map(([questionId, ans]) => ({
            questionId,
            ...ans,
        }));
        setSubmitting(true);
        await dispatch(submitQuizAttempt({ quizId: id, answers: formattedAnswers, timeTaken }));
        setSubmitting(false);
    };

    const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    const answeredCount = Object.keys(answers).length;
    const totalQ = quiz?.questions?.length || 0;

    if (loading) return (
        <div className="app-shell"><Sidebar />
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div>
            </div>
        </div>
    );

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
                        <h1 className="topbar__title">{quiz?.title || 'Quiz'}</h1>
                    </div>
                    {started && !lastResult && (
                        <div className={`quiz-timer ${timeLeft < 60 ? 'quiz-timer--urgent' : ''}`}>
                            ⏱ {formatTime(timeLeft)}
                        </div>
                    )}
                </div>

                <div className="page-body" style={{ maxWidth: 760, margin: '0 auto' }}>

                    {/* Results screen */}
                    {lastResult ? (
                        <div className="quiz-result-screen card">
                            <div className={`quiz-result-screen__badge ${lastResult.passed ? 'passed' : 'failed'}`}>
                                {lastResult.passed ? '🎉' : '😔'}
                            </div>
                            <h2 className="quiz-result-screen__title">
                                {lastResult.passed ? 'Well done! You passed.' : 'Not quite. Keep practicing!'}
                            </h2>
                            <div className="quiz-result-screen__score">
                                <span className="quiz-result-screen__score-val">{lastResult.percentage}%</span>
                                <span className="quiz-result-screen__score-sub">
                  {lastResult.score} / {lastResult.totalMarks} marks
                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 'var(--space-xl)' }}>
                                <button className="btn btn-outline" onClick={() => navigate(-1)}>← Back</button>
                                <button className="btn btn-primary" onClick={() => { dispatch(clearLastResult()); navigate('/student/courses'); }}>
                                    My courses
                                </button>
                            </div>
                        </div>

                    ) : !started ? (
                        /* Start screen */
                        <div className="quiz-start-screen card">
                            <h2 style={{ marginBottom: 'var(--space-sm)' }}>{quiz?.title}</h2>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)' }}>{quiz?.instructions}</p>
                            <div className="quiz-info-grid">
                                {[
                                    { label: 'Questions', value: quiz?.questions?.length },
                                    { label: 'Duration', value: `${quiz?.duration} min` },
                                    { label: 'Total marks', value: quiz?.totalMarks },
                                    { label: 'Pass mark', value: `${quiz?.passingPercentage}%` },
                                    { label: 'Max attempts', value: quiz?.maxAttempts },
                                ].map(({ label, value }) => (
                                    <div key={label} className="quiz-info-item">
                                        <div className="quiz-info-item__val">{value}</div>
                                        <div className="quiz-info-item__label">{label}</div>
                                    </div>
                                ))}
                            </div>
                            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }} onClick={handleStart}>
                                Start quiz →
                            </button>
                        </div>

                    ) : (
                        /* Question screen */
                        <>
                            {/* Progress bar */}
                            <div className="quiz-progress">
                                <div className="quiz-progress__bar">
                                    <div className="quiz-progress__fill" style={{ width: `${(answeredCount / totalQ) * 100}%` }} />
                                </div>
                                <span className="quiz-progress__label">{answeredCount} / {totalQ} answered</span>
                            </div>

                            {quiz.questions.map((q, idx) => (
                                <div key={q._id} className="question-card card">
                                    <div className="question-card__header">
                                        <span className="question-card__num">Q{idx + 1}</span>
                                        <span className="question-card__marks">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                                    </div>
                                    <p className="question-card__text">{q.questionText}</p>

                                    {(q.type === 'mcq' || q.type === 'true_false') && (
                                        <div className="question-options">
                                            {q.options.map((opt) => (
                                                <label
                                                    key={opt._id}
                                                    className={`question-option ${answers[q._id]?.selectedOptionId === opt._id ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`q-${q._id}`}
                                                        value={opt._id}
                                                        checked={answers[q._id]?.selectedOptionId === opt._id}
                                                        onChange={() => handleAnswer(q._id, opt._id, q.type)}
                                                    />
                                                    <span>{opt.text}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {q.type === 'short' && (
                                        <textarea
                                            className="form-input"
                                            rows={3}
                                            placeholder="Your answer…"
                                            value={answers[q._id]?.textAnswer || ''}
                                            onChange={(e) => handleAnswer(q._id, e.target.value, 'short')}
                                            style={{ resize: 'vertical', marginTop: 'var(--space-md)' }}
                                        />
                                    )}
                                </div>
                            ))}

                            {error && <div className="alert alert-error">{error}</div>}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-lg)' }}>
                                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                                    {submitting ? <><span className="spinner"></span> Submitting…</> : `Submit quiz (${answeredCount}/${totalQ})`}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}