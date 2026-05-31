import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import { fetchMyFees } from '../../store/slices/feeSlice';
import './MyFees.css';
import { printInvoice, downloadInvoicePDF } from "../../utils/printInvoice";

const STATUS_STYLES = {
    pending:  { bg: '#FFFBEB', color: '#D97706', label: 'Pending' },
    partial:  { bg: '#EFF6FF', color: '#2563EB', label: 'Partially paid' },
    paid:     { bg: '#ECFDF5', color: '#059669', label: 'Paid' },
    overdue:  { bg: '#FEF2F2', color: '#DC2626', label: 'Overdue' },
    waived:   { bg: '#F9FAFB', color: '#6B7280', label: 'Waived' },
};

export default function MyFees() {
    const dispatch = useDispatch();
    const { myFees: fees, totalDue, loading } = useSelector((s) => s.fees);
    const [filter, setFilter] = useState('');
    const [downloadingId, setDownloadingId] = useState(null);

    useEffect(() => {
        dispatch(fetchMyFees());
    }, [dispatch]);

    const filtered = filter ? fees.filter((f) => f.status === filter) : fees;
    const fmt = (n) => `LKR ${Number(n || 0).toLocaleString()}`;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">My fees</h1>
                </div>

                <div className="page-body">
                    {loading ? (
                        <div className="empty-state"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div></div>
                    ) : (
                        <>
                            {/* Summary banner */}
                            {totalDue > 0 && (
                                <div className="fee-due-banner">
                                    <div>
                                        <p style={{ fontWeight: 600, fontSize: '1rem' }}>Total outstanding</p>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                            Please pay before the due dates to avoid penalties.
                                        </p>
                                    </div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-error)' }}>
                                        {fmt(totalDue)}
                                    </div>
                                </div>
                            )}

                            {/* Filter tabs */}
                            <div className="course-list__status-tabs" style={{ marginBottom: 'var(--space-lg)' }}>
                                {['', 'pending', 'partial', 'paid', 'overdue'].map((s) => (
                                    <button key={s || 'all'} className={`course-status-tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                                        {s || 'All'} ({s ? fees.filter((f) => f.status === s).length : fees.length})
                                    </button>
                                ))}
                            </div>

                            {filtered.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state__icon">💳</div>
                                    <p>No fee records found.</p>
                                </div>
                            ) : (
                                <div className="fee-cards">
                                    {filtered.map((fee) => {
                                        const ss = STATUS_STYLES[fee.status] || STATUS_STYLES.pending;
                                        const isPast = new Date(fee.dueDate) < new Date();
                                        const paidPct = fee.netAmount > 0 ? Math.min(100, Math.round((fee.paidAmount / fee.netAmount) * 100)) : 0;

                                        return (
                                            <div key={fee._id} className="fee-card card">
                                                <div className="fee-card__header">
                                                    <div>
                                                        <div className="fee-card__title">{fee.title}</div>
                                                        <div className="fee-card__meta">
                                                            {fee.course?.code} · {fee.feeType} · {fee.academicYear}
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: ss.bg, color: ss.color }}>
                            {ss.label}
                          </span>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="fee-card__progress-bar">
                                                    <div className="fee-card__progress-fill" style={{ width: `${paidPct}%`, background: fee.status === 'paid' ? '#059669' : '#4F46E5' }} />
                                                </div>

                                                <div className="fee-card__amounts">
                                                    <div>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</p>
                                                        <p style={{ fontWeight: 700, fontSize: '1.125rem' }}>{fmt(fee.netAmount)}</p>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid</p>
                                                        <p style={{ fontWeight: 700, fontSize: '1.125rem', color: '#059669' }}>{fmt(fee.paidAmount)}</p>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining</p>
                                                        <p style={{ fontWeight: 700, fontSize: '1.125rem', color: fee.paidAmount >= fee.netAmount ? '#059669' : 'var(--color-error)' }}>
                                                            {fmt(fee.netAmount - fee.paidAmount)}
                                                        </p>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due</p>
                                                        <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: isPast && fee.status !== 'paid' ? '#DC2626' : 'var(--color-text-primary)' }}>
                                                            {new Date(fee.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Payment history */}
                                                {fee.payments?.length > 0 && (
                                                    <div className="fee-card__payments">
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment history</p>
                                                        {fee.payments.map((p) => (
                                                            <div key={p._id} className="fee-payment-row">
                                                                <span>{new Date(p.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                                                <span style={{ textTransform: 'capitalize' }}>{p.method?.replace('_', ' ')}</span>
                                                                {p.reference && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>#{p.reference}</span>}
                                                                <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#059669' }}>+{fmt(p.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div style={{
                                                    paddingTop: 'var(--space-sm)',
                                                    display: 'flex',
                                                    justifyContent: 'flex-end',
                                                    gap: 'var(--space-sm)',
                                                    borderTop: '1px solid var(--color-border)',
                                                    marginTop: 'var(--space-sm)',
                                                }}>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => printInvoice(fee)}
                                                        style={{ fontSize: '0.875rem' }}
                                                    >
                                                        🖨 Print
                                                    </button>
                                                    <button
                                                        className="btn btn-outline btn-sm"
                                                        onClick={() =>
                                                            downloadInvoicePDF(fee, (loading) =>
                                                                setDownloadingId(loading ? fee._id : null)
                                                            )
                                                        }
                                                        disabled={downloadingId === fee._id}
                                                        style={{ fontSize: '0.875rem' }}
                                                    >
                                                        {downloadingId === fee._id
                                                            ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} /> Generating…</>
                                                            : '⬇ Download PDF'
                                                        }
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}