import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import {
    fetchMyTimetableAsStudent,
    fetchMyTimetableAsTeacher,
} from '../../store/slices/timetableSlice';
import api from '../../api/axios';
import './TimetableViewer.css';

const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetableViewer() {
    const dispatch = useDispatch();
    const { user } = useSelector((s) => s.auth);
    const { mine: timetables, loading, error } = useSelector((s) => s.timetables);

    const isStudent = user?.role === 'student';
    const isTeacher = user?.role === 'teacher';

    useEffect(() => {
        if (isStudent) dispatch(fetchMyTimetableAsStudent());
        if (isTeacher) dispatch(fetchMyTimetableAsTeacher());
    }, [dispatch, isStudent, isTeacher]);

    const getSlot = (timetable, day, periodNumber) =>
        timetable.slots?.find((s) => s.day === day && s.period === periodNumber);

    const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

    // ── Teacher only: merge every section's timetable into ONE grid ──────────
    // Each cell can hold entries from several sections (e.g. Grade 9A Maths
    // P1 and Grade 9B Maths P2), each tagged with its section so a teacher
    // sees one weekly view instead of one grid per section.
    const merged = useMemo(() => {
        if (!isTeacher || !timetables?.length) return null;

        const workingDaysSet = new Set();
        const periodsByNumber = new Map();
        timetables.forEach((tt) => {
            tt.workingDays?.forEach((d) => workingDaysSet.add(d));
            tt.periods?.forEach((p) => {
                if (!periodsByNumber.has(p.number)) periodsByNumber.set(p.number, p);
            });
        });

        const workingDays = DAY_ORDER.filter((d) => workingDaysSet.has(d));
        const periods = [...periodsByNumber.values()].sort((a, b) => a.number - b.number);

        // "day|period" -> [{ subject, sectionLabel, bucket }]
        const cellMap = new Map();
        timetables.forEach((tt) => {
            const sectionLabel = tt.section
                ? `${tt.grade?.gradeNumber || ''}${tt.section?.name}`
                : tt.term;
            const myIds = tt.myTeacherSubjectIds || [];

            tt.slots?.forEach((slot) => {
                if (!slot.isMyClass) return;
                // Only show the subject(s) that are actually THIS teacher's,
                // not sibling bucket subjects taught by someone else.
                const mySubjects = (slot.subjects || []).filter((s) => myIds.includes(String(s._id)));
                if (mySubjects.length === 0) return;

                const key = `${slot.day}|${slot.period}`;
                const entries = cellMap.get(key) || [];
                mySubjects.forEach((subject) => {
                    entries.push({ subject, sectionLabel, bucket: slot.bucket });
                });
                cellMap.set(key, entries);
            });
        });

        return { workingDays, periods, cellMap };
    }, [isTeacher, timetables]);

    const getMergedEntries = (day, periodNumber) => merged?.cellMap.get(`${day}|${periodNumber}`) || [];

    const [downloading, setDownloading] = useState(false);

    const handleDownloadPdf = async () => {
        setDownloading(true);
        try {
            const url = isStudent ? '/timetables/my/student/pdf' : '/timetables/my/teacher/pdf';
            const response = await api.get(url, { responseType: 'blob' });
            const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', isStudent ? 'my-timetable.pdf' : 'my-teaching-schedule.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Failed to download timetable PDF', err);
        }
        setDownloading(false);
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">
                        {isStudent ? 'My timetable' : 'My classes'}
                    </h1>
                    <div className="topbar__right">
                        {!loading && !error && timetables?.length > 0 && (
                            <button className="btn btn-secondary btn-sm" onClick={handleDownloadPdf} disabled={downloading} style={{ marginRight: 'var(--space-sm)' }}>
                                {downloading ? <span className="spinner" /> : '⬇ Download PDF'}
                            </button>
                        )}
                        <NotificationBell />
                    </div>
                </div>

                <div className="page-body">
                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                        </div>
                    ) : error ? (
                        <div className="alert alert-error">{error}</div>
                    ) : !timetables || timetables.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">🗓</div>
                            <p>
                                {isStudent
                                    ? 'No timetable assigned yet. Contact your administrator.'
                                    : 'No classes assigned in any timetable yet.'}
                            </p>
                        </div>
                    ) : isTeacher ? (
                        // ── TEACHER: one merged grid across every section ───────────────
                        <div className="tt-viewer-block">
                            <div className="tt-viewer-header">
                                <div>
                                    <h2 className="tt-viewer-title">My weekly schedule</h2>
                                    <p className="tt-viewer-sub">
                                        {merged.workingDays.length} days · {merged.periods.length} periods · across {timetables.length} section{timetables.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>

                            {merged.workingDays.includes(todayName) && (
                                <div className="tt-today-strip">
                                    <div className="tt-today-strip__label">📅 Today — {todayName}</div>
                                    <div className="tt-today-strip__slots">
                                        {merged.periods.map((period) => {
                                            if (period.isBreak) return null;
                                            const entries = getMergedEntries(todayName, period.number);
                                            return (
                                                <div key={period.number} className="tt-today-slot">
                                                    <div className="tt-today-slot__time">{period.startTime}–{period.endTime}</div>
                                                    <div className="tt-today-slot__subject">
                                                        {entries.length
                                                            ? entries.map((e, i) => (
                                                                <div key={i}>
                                                                    <strong>{e.subject.name}</strong>
                                                                    <span>{e.sectionLabel}</span>
                                                                </div>
                                                            ))
                                                            : <span style={{ color: 'var(--color-text-muted)' }}>Free period</span>
                                                        }
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                                <table className="tt-grid">
                                    <thead>
                                    <tr>
                                        <th className="tt-grid__period-col">Period</th>
                                        {merged.workingDays.map((day) => (
                                            <th key={day} className={`tt-grid__day-col ${day === todayName ? 'tt-grid__day-col--today' : ''}`}>
                                                <div>{DAY_SHORT[day] || day}</div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 400 }}>{day}</div>
                                            </th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {merged.periods.map((period) => (
                                        <tr key={period.number}>
                                            <td className="tt-grid__period-cell">
                                                <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                                                    {period.isBreak ? (period.label || 'Break') : `P${period.number}`}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                                    {period.startTime}–{period.endTime}
                                                </div>
                                            </td>
                                            {merged.workingDays.map((day) => {
                                                if (period.isBreak) {
                                                    return (
                                                        <td key={day} className="tt-grid__break-cell">
                                                            {period.label || 'Break'}
                                                        </td>
                                                    );
                                                }
                                                const entries = getMergedEntries(day, period.number);
                                                const isToday = day === todayName;
                                                return (
                                                    <td
                                                        key={day}
                                                        className={[
                                                            'tt-grid__slot-cell',
                                                            entries.length ? 'tt-grid__slot-cell--filled tt-grid__slot-cell--mine' : '',
                                                            isToday ? 'tt-grid__slot-cell--today' : '',
                                                        ].join(' ')}
                                                    >
                                                        {entries.length ? (
                                                            entries.map((e, i) => (
                                                                <div key={i} style={{ marginBottom: 4 }}>
                                                                    <div className="tt-slot-name">{e.subject.name}</div>
                                                                    <div className="tt-slot-code">{e.subject.code}</div>
                                                                    <div className="tt-slot-teacher">
                                                                        Grade {e.sectionLabel}
                                                                        {e.bucket && <span> · 🪣 {e.bucket}</span>}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="tt-slot-free">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        // ── STUDENT: one block per timetable (normally just one) ────────
                        timetables.map((tt) => (
                            <div key={tt._id} className="tt-viewer-block">
                                {/* Header */}
                                <div className="tt-viewer-header">
                                    <div>
                                        <h2 className="tt-viewer-title">
                                            {tt.section
                                                ? `${tt.grade?.gradeNumber || ''}${tt.section?.name} — ${tt.term}`
                                                : tt.course?.title || tt.term
                                            }
                                        </h2>
                                        <p className="tt-viewer-sub">
                                            Semester {tt.semester} · {tt.workingDays?.length} days · {tt.periods?.length} periods
                                        </p>
                                    </div>
                                    {tt.grade && (
                                        <span className="badge badge-student" style={{ textTransform: 'capitalize' }}>
                      {tt.grade.name}
                    </span>
                                    )}
                                </div>

                                {/* Today's classes highlight */}
                                {tt.workingDays?.includes(todayName) && (
                                    <div className="tt-today-strip">
                                        <div className="tt-today-strip__label">📅 Today — {todayName}</div>
                                        <div className="tt-today-strip__slots">
                                            {[...(tt.periods || [])].sort((a, b) => a.number - b.number).map((period) => {
                                                if (period.isBreak) return null;
                                                const slot = getSlot(tt, todayName, period.number);
                                                return (
                                                    <div key={period.number} className="tt-today-slot">
                                                        <div className="tt-today-slot__time">{period.startTime}–{period.endTime}</div>
                                                        <div className="tt-today-slot__subject">
                                                            {slot?.subjects?.length
                                                                ? slot.subjects.map((subj) => (
                                                                    <div key={subj._id}>
                                                                        <strong>{subj.name}</strong>
                                                                        <span>{subj.teacher?.name || ''}</span>
                                                                    </div>
                                                                ))
                                                                : <span style={{ color: 'var(--color-text-muted)' }}>Free period</span>
                                                            }
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Full grid */}
                                <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                                    <table className="tt-grid">
                                        <thead>
                                        <tr>
                                            <th className="tt-grid__period-col">Period</th>
                                            {tt.workingDays?.map((day) => (
                                                <th key={day} className={`tt-grid__day-col ${day === todayName ? 'tt-grid__day-col--today' : ''}`}>
                                                    <div>{DAY_SHORT[day] || day}</div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 400 }}>{day}</div>
                                                </th>
                                            ))}
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {[...(tt.periods || [])].sort((a, b) => a.number - b.number).map((period) => (
                                            <tr key={period.number}>
                                                <td className="tt-grid__period-cell">
                                                    <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                                                        {period.isBreak ? (period.label || 'Break') : `P${period.number}`}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                                        {period.startTime}–{period.endTime}
                                                    </div>
                                                </td>
                                                {tt.workingDays?.map((day) => {
                                                    if (period.isBreak) {
                                                        return (
                                                            <td key={day} className="tt-grid__break-cell">
                                                                {period.label || 'Break'}
                                                            </td>
                                                        );
                                                    }
                                                    const slot     = getSlot(tt, day, period.number);
                                                    const subjects = slot?.subjects || [];
                                                    const isToday  = day === todayName;
                                                    return (
                                                        <td
                                                            key={day}
                                                            className={[
                                                                'tt-grid__slot-cell',
                                                                subjects.length ? 'tt-grid__slot-cell--filled' : '',
                                                                isToday ? 'tt-grid__slot-cell--today' : '',
                                                            ].join(' ')}
                                                        >
                                                            {subjects.length ? (
                                                                <>
                                                                    {subjects.map((subject) => (
                                                                        <div key={subject._id} style={{ marginBottom: 4 }}>
                                                                            <div className="tt-slot-name">{subject.name}</div>
                                                                            <div className="tt-slot-code">{subject.code}</div>
                                                                            {subject.teacher?.name && (
                                                                                <div className="tt-slot-teacher">{subject.teacher.name}</div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    {slot.bucket && (
                                                                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                                                                            🪣 {slot.bucket}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="tt-slot-free">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}