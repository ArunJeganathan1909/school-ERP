import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import { fetchAllFees, createFee, recordPayment, deleteFee } from '../../store/slices/feeSlice';
import { fetchCourses } from '../../store/slices/courseSlice';
import './ManageFees.css';

const FEE_TYPES = ['tuition', 'exam', 'library', 'lab', 'transport', 'hostel', 'other'];
const STATUS_STYLES = {
    pending:  { bg: '#FFFBEB', color: '#D97706' },
    partial:  { bg: '#EFF6FF', color: '#2563EB' },
    paid:     { bg: '#ECFDF5', color: '#059669' },
    overdue:  { bg: '#FEF2F2', color: '#DC2626' },
    waived:   { bg: '#F9FAFB', color: '#6B7280' },
};

const EMPTY_FEE = {
    student: '', course: '', feeType: 'tuition', title: '',
    totalAmount: '', discount: 0, dueDate: '', academicYear: '', semester: 1,
};

export default function ManageFees() {
    const dispatch = useDispatch();
    const { list: fees, stats, total, loading, error } = useSelector((s) => s.fees);
    const { list: courses } = useSelector((s) => s.courses);

    const [showCreate, setShowCreate] = useState(false);
    const [showPayment, setShowPayment] = useState(null); // fee object
    const [form, setForm] = useState(EMPTY_FEE);
    const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', reference: '' });
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        dispatch(fetchCourses({ limit: 100 }));
        // initial load — no status filter
        dispatch(fetchAllFees({ limit: 30 }));
    }, [dispatch]);

    useEffect(() => {
        // only add status to params if it's not empty
        const params = { limit: 30 };
        if (statusFilter) params.status = statusFilter;
        dispatch(fetchAllFees(params));
    }, [dispatch, statusFilter]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        await dispatch(createFee(form));
        setSaving(false);
        setShowCreate(false);
        setForm(EMPTY_FEE);
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        if (!showPayment) return;
        setSaving(true);
        await dispatch(recordPayment({ id: showPayment._id, ...paymentForm, amount: Number(paymentForm.amount) }));
        setSaving(false);
        setShowPayment(null);
        setPaymentForm({ amount: '', method: 'cash', reference: '' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this fee record?')) return;
        dispatch(deleteFee(id));
    };

    const fmt = (n) => `LKR ${Number(n || 0).toLocaleString()}`;

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <div className="topbar">
                    <h1 className="topbar__title">Fee management</h1>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New invoice</button>
                </div>

                <div className="page-body">
                    {/* Stats row */}
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                        {[
                            { label: 'Total expected', value: fmt(stats.totalExpected), icon: '💰', color: '#4F46E5', bg: '#EEF2FF' },
                            { label: 'Collected',      value: fmt(stats.totalCollected), icon: '✅', color: '#059669', bg: '#ECFDF5' },
                            { label: 'Outstanding',    value: fmt((stats.totalExpected || 0) - (stats.totalCollected || 0)), icon: '⏳', color: '#D97706', bg: '#FFFBEB' },
                            { label: 'Overdue',        value: stats.overdue || 0, icon: '⚠', color: '#DC2626', bg: '#FEF2F2' },
                        ].map((s) => (
                            <div key={s.label} className="stat-card">
                                <div className="stat-card__icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                                <div className="stat-card__value">{s.value}</div>
                                <div className="stat-card__label">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Filter tabs */}
                    <div className="course-list__status-tabs" style={{ marginBottom: 'var(--space-lg)' }}>
                        {['', 'pending', 'partial', 'paid', 'overdue'].map((s) => (
                            <button
                                key={s || 'all'}
                                className={`course-status-tab ${statusFilter === s ? 'active' : ''}`}
                                onClick={() => setStatusFilter(s)}
                            >
                                {s || 'All'}
                            </button>
                        ))}
                    </div>

                    {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

                    {/* Table */}
                    {loading ? (
                        <div className="empty-state"><div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }}></div></div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Title</th>
                                    <th>Course</th>
                                    <th>Amount</th>
                                    <th>Paid</th>
                                    <th>Due date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {fees.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>No fee records found.</td></tr>
                                ) : fees.map((fee) => {
                                    const ss = STATUS_STYLES[fee.status] || STATUS_STYLES.pending;
                                    const isPast = new Date(fee.dueDate) < new Date();
                                    return (
                                        <tr key={fee._id}>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{fee.student?.name}</div>
                                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{fee.student?.email}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{fee.title}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{fee.feeType}</div>
                                            </td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{fee.course?.code}</td>
                                            <td style={{ fontWeight: 600 }}>{fmt(fee.netAmount)}</td>
                                            <td style={{ color: fee.paidAmount >= fee.netAmount ? '#059669' : 'var(--color-text-secondary)' }}>
                                                {fmt(fee.paidAmount)}
                                            </td>
                                            <td style={{ color: isPast && fee.status !== 'paid' ? '#DC2626' : 'var(--color-text-secondary)' }}>
                                                {new Date(fee.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: ss.bg, color: ss.color, textTransform: 'capitalize' }}>
                            {fee.status}
                          </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                                    {fee.status !== 'paid' && fee.status !== 'waived' && (
                                                        <button className="btn btn-primary btn-sm" onClick={() => setShowPayment(fee)}>
                                                            Pay
                                                        </button>
                                                    )}
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(fee._id)}>Del</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create fee modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">New fee invoice</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <form className="modal__body" onSubmit={handleCreate}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Student ID *</label>
                                    <input className="form-input" name="student" value={form.student} onChange={handleChange} required placeholder="MongoDB ObjectId" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Course *</label>
                                    <select className="form-input" name="course" value={form.course} onChange={handleChange} required>
                                        <option value="">Select course</option>
                                        {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Fee type</label>
                                    <select className="form-input" name="feeType" value={form.feeType} onChange={handleChange}>
                                        {FEE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Title *</label>
                                    <input className="form-input" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Semester 1 tuition fee" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Total amount (LKR) *</label>
                                    <input className="form-input" type="number" name="totalAmount" value={form.totalAmount} onChange={handleChange} required min={0} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Discount (LKR)</label>
                                    <input className="form-input" type="number" name="discount" value={form.discount} onChange={handleChange} min={0} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Due date *</label>
                                    <input className="form-input" type="date" name="dueDate" value={form.dueDate} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Academic year</label>
                                    <input className="form-input" name="academicYear" value={form.academicYear} onChange={handleChange} placeholder="2024-2025" />
                                </div>
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner"></span> Creating…</> : 'Create invoice'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Record payment modal */}
            {showPayment && (
                <div className="modal-overlay" onClick={() => setShowPayment(null)}>
                    <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2 className="modal__title">Record payment</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowPayment(null)}>✕</button>
                        </div>
                        <form className="modal__body" onSubmit={handlePayment}>
                            <div className="fee-payment-info">
                                <div>
                                    <p style={{ fontWeight: 600 }}>{showPayment.student?.name}</p>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{showPayment.title}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Remaining</p>
                                    <p style={{ fontWeight: 700, color: 'var(--color-error)', fontSize: '1.125rem' }}>
                                        {fmt(showPayment.netAmount - showPayment.paidAmount)}
                                    </p>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Amount (LKR) *</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                                    required
                                    min={1}
                                    max={showPayment.netAmount - showPayment.paidAmount}
                                    placeholder="Enter amount"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Payment method</label>
                                <select
                                    className="form-input"
                                    value={paymentForm.method}
                                    onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))}
                                >
                                    {['cash', 'bank_transfer', 'online', 'cheque'].map((m) => (
                                        <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reference / Receipt no.</label>
                                <input
                                    className="form-input"
                                    value={paymentForm.reference}
                                    onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowPayment(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner"></span> Recording…</> : 'Record payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}