import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchMyTimetableAsStudent,
    fetchMyTimetableAsTeacher,
} from '../../store/slices/timetableSlice';

export default function TimetableViewer() {
    const dispatch = useDispatch();
    const { user } = useSelector((s) => s.auth);
    const { mine, loading, error } = useSelector((s) => s.timetables);

    const isTeacher = user?.role === 'teacher';

    useEffect(() => {
        if (isTeacher) {
            dispatch(fetchMyTimetableAsTeacher());
        } else {
            dispatch(fetchMyTimetableAsStudent());
        }
    }, [dispatch, isTeacher]);

    const getSlot = (timetable, day, periodNumber) =>
        timetable.slots?.find((s) => s.day === day && s.period === periodNumber);

    return (
        <div className="page-body">
            <div className="dashboard-welcome">
                <div className="dashboard-welcome__text">
                    <h2>My Timetable</h2>
                    <p>
                        {isTeacher
                            ? 'Your teaching schedule across all assigned subjects.'
                            : 'Your weekly class schedule.'}
                    </p>
                </div>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>}

            {loading ? (
                <p>Loading timetable…</p>
            ) : mine.length === 0 ? (
                <div className="card">
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        {isTeacher
                            ? 'No timetable available for your assigned subjects yet.'
                            : 'No timetable available for your enrolled courses yet.'}
                    </p>
                </div>
            ) : (
                mine.map((tt) => (
                    <div key={tt._id} className="card" style={{ marginBottom: 'var(--space-lg)', overflowX: 'auto' }}>
                        <div className="card-header">
                            <div className="card-title">
                                {tt.course?.title} ({tt.course?.code})
                            </div>
                            <span className="badge badge-success">{tt.term}</span>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                            <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                    Period
                                </th>
                                {tt.workingDays.map((day) => (
                                    <th key={day} style={{ textAlign: 'left', padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                        {day}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {[...tt.periods].sort((a, b) => a.number - b.number).map((period) => (
                                <tr key={period.number}>
                                    <td style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                            {period.isBreak ? (period.label || 'Break') : `Period ${period.number}`}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            {period.startTime} – {period.endTime}
                                        </div>
                                    </td>
                                    {tt.workingDays.map((day) => {
                                        if (period.isBreak) {
                                            return (
                                                <td key={day} style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                            {period.label || 'Break'}
                                                        </span>
                                                </td>
                                            );
                                        }
                                        const slot = getSlot(tt, day, period.number);
                                        const subject = slot?.subject;
                                        const isMyClass = isTeacher && slot?.isMyClass;

                                        return (
                                            <td
                                                key={day}
                                                style={{
                                                    padding: 'var(--space-sm)',
                                                    borderBottom: '1px solid var(--color-border)',
                                                    background: isMyClass ? 'var(--color-primary-light)' : undefined,
                                                }}
                                            >
                                                {subject ? (
                                                    <div>
                                                        <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{subject.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                            {subject.code}
                                                            {subject.teacher?.name ? ` · ${subject.teacher.name}` : ''}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Free</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ))
            )}
        </div>
    );
}