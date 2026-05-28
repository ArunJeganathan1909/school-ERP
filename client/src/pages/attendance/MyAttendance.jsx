import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import { fetchMyAttendance } from '../../store/slices/attendanceSlice';
import './MyAttendance.css';

const STATUS_STYLES = {
    present: { bg: '#ECFDF5', color: '#059669', label: 'Present' },
    absent:  { bg: '#FEF2F2', color: '#DC2626', label: 'Absent' },
    late:    { bg: '#FFFBEB', color: '#D97706', label: 'Late' },
    excused: { bg: '#EFF6FF', color: '#2563EB', label: 'Excused' },
};

export default function MyAttendance() {
    const dispatch = useDispatch();
    const { myRecords, mySummary, loading } = useSelector((s) => s.attendance);

    useEffect(() => {
        dispatch(fetchMyAttendance());
    }, [dispatch]);

    const overallPresent = myRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
    const overallPct = myRecords.length > 0 ? Math.round((overallPresent / myRecords.length) * 100) : 0;
    const pctColor = overallPct >= 75 ? '#059669' : overallPct >= 60 ? '#D97706' : '#DC2626';

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">My attendance</h1>
                </div>

                <div className="page-body">
                    {loading ? (
                        <div className="empty-state"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div></div>
                    ) : (
                        <>
                            {/* Overall card */}
                            <div className="attendance-overview card">
                                <div className="attendance-overview__circle" style={{ borderColor: pctColor, color: pctColor }}>
                                    <span className="attendance-overview__pct">{overallPct}%</span>
                                    <span className="attendance-overview__label">Overall</span>
                                </div>
                                <div className="attendance-overview__stats">
                                    <div className="attendance-overview__stat">
                                        <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{myRecords.length}</span>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Total classes</span>
                                    </div>
                                    <div className="attendance-overview__stat">
                                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{overallPresent}</span>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Attended</span>
                                    </div>
                                    <div className="attendance-overview__stat">
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626' }}>
                      {myRecords.filter((r) => r.status === 'absent').length}
                    </span>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Absent</span>
                                    </div>
                                    {overallPct < 75 && (
                                        <div className="alert alert-error" style={{ marginTop: 0, alignSelf: 'center' }}>
                                            ⚠ Below 75% — attendance may affect eligibility
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Per-subject summary */}
                            {mySummary.length > 0 && (
                                <>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>By subject</h2>
                                    <div className="subject-attendance-grid">
                                        {mySummary.map((s) => {
                                            const barColor = s.percentage >= 75 ? '#059669' : s.percentage >= 60 ? '#D97706' : '#DC2626';
                                            return (
                                                <div key={s.subject?._id} className="subject-attendance-card card">
                                                    <div className="subject-attendance-card__header">
                                                        <div>
                                                            <div style={{ fontWeight: 600 }}>{s.subject?.name}</div>
                                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{s.subject?.code}</div>
                                                        </div>
                                                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: barColor }}>{s.percentage}%</span>
                                                    </div>
                                                    <div className="subject-attendance-bar">
                                                        <div className="subject-attendance-bar__fill" style={{ width: `${s.percentage}%`, background: barColor }} />
                                                    </div>
                                                    <div className="subject-attendance-card__counts">
                                                        {['present', 'absent', 'late', 'excused'].map((st) => (
                                                            s[st] > 0 && (
                                                                <span key={st} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: STATUS_STYLES[st].bg, color: STATUS_STYLES[st].color }}>
                                  {s[st]} {st}
                                </span>
                                                            )
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* Recent records */}
                            {myRecords.length > 0 && (
                                <>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 'var(--space-xl) 0 var(--space-md)' }}>Recent records</h2>
                                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                        <table className="data-table">
                                            <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Subject</th>
                                                <th>Status</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {myRecords.slice(0, 30).map((record) => {
                                                const ss = STATUS_STYLES[record.status];
                                                return (
                                                    <tr key={record._id}>
                                                        <td style={{ color: 'var(--color-text-secondary)' }}>
                                                            {new Date(record.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                        </td>
                                                        <td style={{ fontWeight: 500 }}>{record.subject?.name}</td>
                                                        <td>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-full)', background: ss.bg, color: ss.color }}>
                                  {ss.label}
                                </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {myRecords.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-state__icon">✅</div>
                                    <p>No attendance records yet.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}