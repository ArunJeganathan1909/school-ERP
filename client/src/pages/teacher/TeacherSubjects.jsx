import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { fetchMyTeaching } from '../../store/slices/subjectTeacherAssignmentSlice';
import './TeacherSubjects.css';

export default function TeacherSubjects() {
    const dispatch = useDispatch();
    const { myTeaching, loading, error } = useSelector((s) => s.subjectTeacherAssignments);

    useEffect(() => {
        dispatch(fetchMyTeaching());
    }, [dispatch]);

    // Group by subject so a teacher who teaches Maths to 3 sections sees one card
    // with all 3 sections listed, instead of 3 separate cards.
    const grouped = myTeaching.reduce((acc, a) => {
        const key = a.subject?._id;
        if (!acc[key]) {
            acc[key] = { subject: a.subject, sections: [] };
        }
        acc[key].sections.push(a.section);
        return acc;
    }, {});

    const groups = Object.values(grouped);
    const totalSections = myTeaching.length;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">My subjects</h1>
                    <div className="topbar__right"><NotificationBell /></div>
                </div>

                <div className="page-body">
                    {/* Stats strip */}
                    <div className="subject-stats-strip" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div className="subject-stats-strip__item">
                            <span className="subject-stats-strip__val">{groups.length}</span>
                            <span className="subject-stats-strip__label">Subjects</span>
                        </div>
                        <div className="subject-stats-strip__item">
                            <span className="subject-stats-strip__val" style={{ color: '#4F46E5' }}>{totalSections}</span>
                            <span className="subject-stats-strip__label">Sections</span>
                        </div>
                    </div>

                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📖</div>
                            <p>No subjects assigned yet. Contact your administrator to be assigned to a section.</p>
                        </div>
                    ) : (
                        <div className="teacher-subjects-grid">
                            {groups.map(({ subject, sections }) => (
                                <div key={subject?._id} className="teacher-subject-card card">
                                    <div className="teacher-subject-card__header">
                                        <div>
                                            <div className="teacher-subject-card__name">{subject?.name}</div>
                                            <div className="teacher-subject-card__code">{subject?.code}</div>
                                        </div>
                                        {!subject?.isMandatory && (
                                            <span className="badge badge-teacher" style={{ textTransform: 'none' }}>{subject?.bucket}</span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                        <span>{subject?.credits} credits</span>
                                        <span>Semester {subject?.semester}</span>
                                    </div>

                                    <div className="teacher-subject-card__sections">
                                        <p className="teacher-subject-card__sections-label">
                                            Teaching {sections.length} section{sections.length !== 1 ? 's' : ''}
                                        </p>
                                        <div className="teacher-subject-card__section-chips">
                                            {sections.map((sec) => (
                                                <span key={sec?._id} className="section-chip">
                          {sec?.grade?.gradeNumber}{sec?.name}
                                                    {sec?.grade?.stream && sec.grade.stream !== 'none' ? ` (${sec.grade.stream})` : ''}
                        </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}