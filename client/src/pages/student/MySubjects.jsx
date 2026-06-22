import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchMySubjects } from '../../store/slices/subjectEnrollmentSlice';
import { fetchMyCurrentSection } from '../../store/slices/studentSectionSlice';
import './MySubjects.css';

export default function MySubjects() {
    const dispatch = useDispatch();
    const { myMandatory, myBuckets, loading } = useSelector((s) => s.subjectEnrollments);
    const { myCurrent } = useSelector((s) => s.studentSections);

    useEffect(() => {
        dispatch(fetchMyCurrentSection());
        dispatch(fetchMySubjects());
    }, [dispatch]);

    // Group bucket subjects by bucket name to detect any missing ones
    const bucketsByName = myBuckets.reduce((acc, e) => {
        acc[e.bucket] = e;
        return acc;
    }, {});

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">My subjects</h1>
                    <div className="topbar__right"><NotificationBell /></div>
                </div>

                <div className="page-body">
                    {myCurrent && (
                        <div className="card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                            <div>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Currently enrolled in</p>
                                <p style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                                    Grade {myCurrent.grade?.gradeNumber}{myCurrent.section?.name}
                                    {myCurrent.grade?.stream !== 'none' && <span style={{ color: 'var(--color-primary)' }}> ({myCurrent.grade?.stream})</span>}
                                </p>
                            </div>
                            <span className="badge badge-student">Semester {myCurrent.academicYear?.currentSemester}</span>
                        </div>
                    )}

                    {/* Summary strip */}
                    <div className="subject-stats-strip" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val" style={{ color: '#4F46E5' }}>{myMandatory.length}</span><span className="subject-stats-strip__label">Mandatory</span></div>
                        <div className="subject-stats-strip__item"><span className="subject-stats-strip__val" style={{ color: '#7C3AED' }}>{myBuckets.length}</span><span className="subject-stats-strip__label">Electives chosen</span></div>
                    </div>

                    {loading ? (
                        <div className="empty-state"><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /></div>
                    ) : (
                        <>
                            {/* Mandatory */}
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>📌 Mandatory subjects</h3>
                            {myMandatory.length === 0 ? (
                                <div className="empty-state" style={{ marginBottom: 'var(--space-xl)' }}><div className="empty-state__icon">📚</div><p>No mandatory subjects enrolled yet. Contact your administrator.</p></div>
                            ) : (
                                <div className="my-subjects-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                                    {myMandatory.map((e) => <SubjectCard key={e._id} enrollment={e} />)}
                                </div>
                            )}

                            {/* Electives */}
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>🪣 Elective subjects</h3>
                            {myBuckets.length === 0 ? (
                                <div className="empty-state"><div className="empty-state__icon">🪣</div><p>No elective subjects assigned yet. Your administrator will assign your bucket choices.</p></div>
                            ) : (
                                <div className="my-subjects-grid">
                                    {myBuckets.map((e) => <SubjectCard key={e._id} enrollment={e} showBucket />)}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function SubjectCard({ enrollment, showBucket }) {
    const [expanded, setExpanded] = useState(false);
    const s = enrollment.subject;

    return (
        <div className="my-subject-card card" onClick={() => setExpanded((x) => !x)}>
            <div className="my-subject-card__header">
                <div>
                    <div className="my-subject-card__name">{s?.name}</div>
                    <div className="my-subject-card__code">{s?.code}</div>
                </div>
                {showBucket && <span className="badge badge-teacher" style={{ textTransform: 'none' }}>{enrollment.bucket}</span>}
            </div>

            {s?.teacher?.name && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>👨‍🏫 {s.teacher.name}</p>}

            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                <span>{s?.credits} credits</span>
                <span>Semester {s?.semester}</span>
            </div>

            {expanded && (
                <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                    {s?.schedule?.length > 0 ? (
                        s.schedule.map((slot, i) => (
                            <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                                {slot.day} · {slot.startTime}–{slot.endTime}{slot.room ? ` · ${slot.room}` : ''}
                            </div>
                        ))
                    ) : (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>No schedule set yet.</p>
                    )}
                    {enrollment.marks !== null && (
                        <p style={{ fontSize: '0.875rem', marginTop: 'var(--space-sm)' }}>
                            Marks: <strong>{enrollment.marks}</strong> {enrollment.grade_letter && `(${enrollment.grade_letter})`}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}