import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import {
    fetchAllFees,
    createFee,
    recordPayment,
    deleteFee,
} from '../../store/slices/feeSlice';
import api from '../../api/axios';
import './ManageFees.css';
import { printInvoice } from "../../utils/printInvoice";

const FEE_TYPES = ['tuition', 'exam', 'library', 'lab', 'transport', 'hostel', 'other'];

const STATUS_STYLES = {
    pending: { bg: '#FFFBEB', color: '#D97706' },
    partial: { bg: '#EFF6FF', color: '#2563EB' },
    paid:    { bg: '#ECFDF5', color: '#059669' },
    overdue: { bg: '#FEF2F2', color: '#DC2626' },
    waived:  { bg: '#F9FAFB', color: '#6B7280' },
};

const EMPTY_FEE = {
    student:      '',
    courses:      [],   // array of selected course IDs
    feeType:      'tuition',
    title:        '',
    totalAmount:  '',
    discount:     0,
    dueDate:      '',
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    semester:     1,
};

export default function ManageFees() {
    const dispatch = useDispatch();
    const { list: fees, stats, total, loading, error } = useSelector((s) => s.fees);

    const [statusFilter, setStatusFilter] = useState('');

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm]             = useState(EMPTY_FEE);
    const [saving, setSaving]         = useState(false);
    const [formError, setFormError]   = useState('');

    // Student search state
    const [studentSearch,   setStudentSearch]   = useState('');
    const [studentResults,  setStudentResults]  = useState([]);
    const [studentLoading,  setStudentLoading]  = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showDropdown,    setShowDropdown]    = useState(false);
    const searchRef  = useRef(null);
    const debounceRef = useRef(null);

    // Enrolled courses for selected student
    const [enrolledCourses,  setEnrolledCourses]  = useState([]);
    const [coursesLoading,   setCoursesLoading]   = useState(false);

    // Payment modal
    const [showPayment,  setShowPayment]  = useState(null);
    const [paymentForm,  setPaymentForm]  = useState({ amount: '', method: 'cash', reference: '' });
    const [paymentSaving, setPaymentSaving] = useState(false);

    /* ── initial load ── */
    useEffect(() => {
        dispatch(fetchAllFees({ limit: 30 }));
    }, [dispatch]);

    useEffect(() => {
        const params = { limit: 30 };
        if (statusFilter) params.status = statusFilter;
        dispatch(fetchAllFees(params));
    }, [dispatch, statusFilter]);

    /* ── close student dropdown on outside click ── */
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* ── student search with debounce ── */
    const handleStudentSearch = (value) => {
        setStudentSearch(value);
        setShowDropdown(true);

        // Clear selected student if user edits search
        if (selectedStudent && value !== selectedStudent.name) {
            setSelectedStudent(null);
            setForm((f) => ({ ...f, student: '', courses: [] }));
            setEnrolledCourses([]);
        }

        clearTimeout(debounceRef.current);
        if (!value.trim()) {
            setStudentResults([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setStudentLoading(true);
            try {
                const { data } = await api.get(
                    `/users?role=student&search=${encodeURIComponent(value)}&limit=10`
                );
                setStudentResults(data.users || []);
            } catch {
                setStudentResults([]);
            }
            setStudentLoading(false);
        }, 350);
    };

    /* ── select a student from dropdown ── */
    const handleSelectStudent = async (student) => {
        setSelectedStudent(student);
        setStudentSearch(student.name);
        setShowDropdown(false);
        setStudentResults([]);
        setForm((f) => ({ ...f, student: student._id, courses: [] }));

        // Load enrolled courses for this student using admin endpoint
        setCoursesLoading(true);
        try {
            const { data } = await api.get(
                `/enrollments?student=${student._id}&status=active&limit=50`
            );
            const enrollments = data.enrollments || [];
            // Extract the course object from each enrollment
            const courses = enrollments
                .map((e) => e.course)
                .filter(Boolean);
            setEnrolledCourses(courses);
        } catch (err) {
            console.error('Failed to load enrollments:', err);
            setEnrolledCourses([]);
        }
        setCoursesLoading(false);
    };

    /* ── toggle course selection ── */
    const toggleCourse = (courseId) => {
        setForm((f) => {
            const already = f.courses.includes(courseId);
            return {
                ...f,
                courses: already
                    ? f.courses.filter((id) => id !== courseId)
                    : [...f.courses, courseId],
            };
        });
    };

    /* ── handle regular form fields ── */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    /* ── open create modal ── */
    const openCreate = () => {
        setForm(EMPTY_FEE);
        setSelectedStudent(null);
        setStudentSearch('');
        setEnrolledCourses([]);
        setFormError('');
        setShowCreate(true);
    };

    /* ── submit: create one fee per selected course ── */
    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!form.student) {
            setFormError('Please select a student.');
            return;
        }
        if (form.courses.length === 0) {
            setFormError('Please select at least one course.');
            return;
        }
        if (!form.title || !form.totalAmount || !form.dueDate) {
            setFormError('Title, amount, and due date are required.');
            return;
        }

        setSaving(true);
        try {
            // Create one invoice per selected course
            for (const courseId of form.courses) {
                await api.post('/fees', {
                    student:      form.student,
                    course:       courseId,
                    feeType:      form.feeType,
                    title:        form.title,
                    totalAmount:  Number(form.totalAmount),
                    discount:     Number(form.discount) || 0,
                    dueDate:      form.dueDate,
                    academicYear: form.academicYear,
                    semester:     Number(form.semester),
                });
            }

            setShowCreate(false);
            setForm(EMPTY_FEE);
            setSelectedStudent(null);
            setStudentSearch('');
            setEnrolledCourses([]);

            // Refresh fee list
            const params = { limit: 30 };
            if (statusFilter) params.status = statusFilter;
            dispatch(fetchAllFees(params));
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to create invoice');
        }
        setSaving(false);
    };

    /* ── record payment ── */
    const handlePayment = async (e) => {
        e.preventDefault();
        if (!showPayment) return;
        setPaymentSaving(true);
        await dispatch(
            recordPayment({
                id:     showPayment._id,
                amount: Number(paymentForm.amount),
                method: paymentForm.method,
                reference: paymentForm.reference,
            })
        );
        setPaymentSaving(false);
        setShowPayment(null);
        setPaymentForm({ amount: '', method: 'cash', reference: '' });
    };

    /* ── delete ── */
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this fee record?')) return;
        dispatch(deleteFee(id));
    };

    const fmt = (n) => `LKR ${Number(n || 0).toLocaleString()}`;

    /* ── initials helper ── */
    const initials = (name) =>
        name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">

                <div className="topbar">
                    <h1 className="topbar__title">Fee management</h1>
                    <div className="topbar__right">
                        <NotificationBell />
                        <button className="btn btn-primary" onClick={openCreate}>
                            + New invoice
                        </button>
                    </div>
                </div>

                <div className="page-body">

                    {/* Stats */}
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                        {[
                            { label: 'Total expected', value: fmt(stats.totalExpected),  icon: '💰', color: '#4F46E5', bg: '#EEF2FF' },
                            { label: 'Collected',      value: fmt(stats.totalCollected),  icon: '✅', color: '#059669', bg: '#ECFDF5' },
                            { label: 'Outstanding',    value: fmt((stats.totalExpected || 0) - (stats.totalCollected || 0)), icon: '⏳', color: '#D97706', bg: '#FFFBEB' },
                            { label: 'Overdue',        value: stats.overdue || 0,         icon: '⚠',  color: '#DC2626', bg: '#FEF2F2' },
                        ].map((s) => (
                            <div key={s.label} className="stat-card">
                                <div className="stat-card__icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                                <div className="stat-card__value">{s.value}</div>
                                <div className="stat-card__label">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Status filter tabs */}
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

                    {error && (
                        <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                            {error}
                        </div>
                    )}

                    {/* Fees table */}
                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner" style={{ borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                        </div>
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
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
                                            No fee records found.
                                        </td>
                                    </tr>
                                ) : fees.map((fee) => {
                                    const ss     = STATUS_STYLES[fee.status] || STATUS_STYLES.pending;
                                    const isPast = new Date(fee.dueDate) < new Date();
                                    return (
                                        <tr key={fee._id}>
                                            <td>
                                                <div className="fee-table-student">
                                                    <div className="fee-table-student__avatar">
                                                        {initials(fee.student?.name)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{fee.student?.name}</div>
                                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                            {fee.student?.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{fee.title}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                                                    {fee.feeType}
                                                </div>
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
                                                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                                    {/* Print invoice */}
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => printInvoice(fee)}
                                                        title="Print invoice"
                                                        style={{ fontSize: '0.875rem' }}
                                                    >
                                                        🖨
                                                    </button>

                                                    {/* Record payment */}
                                                    {fee.status !== 'paid' && fee.status !== 'waived' && (
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => setShowPayment(fee)}
                                                        >
                                                            Pay
                                                        </button>
                                                    )}

                                                    {/* Delete */}
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleDelete(fee._id)}
                                                    >
                                                        Del
                                                    </button>
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

            {/* ══ CREATE INVOICE MODAL ══ */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div
                        className="modal"
                        style={{ maxWidth: 640 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal__header">
                            <h2 className="modal__title">New fee invoice</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
                        </div>

                        {formError && (
                            <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                                {formError}
                            </div>
                        )}

                        <form className="modal__body" onSubmit={handleCreate}>

                            {/* ── Student search ── */}
                            <div className="form-group">
                                <label className="form-label">Student *</label>
                                <div className="fee-student-search" ref={searchRef}>
                                    <div className="fee-student-search__input-wrap">
                                        <span className="fee-student-search__icon">🔍</span>
                                        <input
                                            className="fee-student-search__input"
                                            type="text"
                                            placeholder="Type student name or email to search…"
                                            value={studentSearch}
                                            onChange={(e) => handleStudentSearch(e.target.value)}
                                            onFocus={() => studentSearch && setShowDropdown(true)}
                                            autoComplete="off"
                                        />
                                        {selectedStudent && (
                                            <span className="fee-student-search__check">✓</span>
                                        )}
                                    </div>

                                    {/* Dropdown results */}
                                    {showDropdown && (
                                        <div className="fee-student-dropdown">
                                            {studentLoading ? (
                                                <div className="fee-student-dropdown__loading">
                                                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                                    <span>Searching…</span>
                                                </div>
                                            ) : studentResults.length === 0 ? (
                                                <div className="fee-student-dropdown__empty">
                                                    {studentSearch.length > 0 ? 'No students found.' : 'Start typing to search students.'}
                                                </div>
                                            ) : studentResults.map((s) => (
                                                <button
                                                    key={s._id}
                                                    type="button"
                                                    className="fee-student-dropdown__item"
                                                    onClick={() => handleSelectStudent(s)}
                                                >
                                                    <div className="fee-student-dropdown__avatar">
                                                        {initials(s.name)}
                                                    </div>
                                                    <div>
                                                        <div className="fee-student-dropdown__name">{s.name}</div>
                                                        <div className="fee-student-dropdown__email">{s.email}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selected student chip */}
                                {selectedStudent && (
                                    <div className="fee-selected-student">
                                        <div className="fee-selected-student__avatar">
                                            {initials(selectedStudent.name)}
                                        </div>
                                        <div className="fee-selected-student__info">
                                            <span className="fee-selected-student__name">{selectedStudent.name}</span>
                                            <span className="fee-selected-student__email">{selectedStudent.email}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="fee-selected-student__remove"
                                            onClick={() => {
                                                setSelectedStudent(null);
                                                setStudentSearch('');
                                                setEnrolledCourses([]);
                                                setForm((f) => ({ ...f, student: '', courses: [] }));
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ── Course selection (only after student selected) ── */}
                            <div className="form-group">
                                <label className="form-label">
                                    Course(s) * — select one or more
                                </label>

                                {!selectedStudent ? (
                                    <div className="fee-course-placeholder">
                                        👆 Select a student first to see their enrolled courses
                                    </div>
                                ) : coursesLoading ? (
                                    <div className="fee-course-placeholder">
                                        <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                        <span>Loading enrolled courses…</span>
                                    </div>
                                ) : enrolledCourses.length === 0 ? (
                                    <div className="fee-course-placeholder fee-course-placeholder--warn">
                                        ⚠ This student is not enrolled in any active courses.
                                    </div>
                                ) : (
                                    <div className="fee-course-checkboxes">
                                        {enrolledCourses.map((course) => {
                                            const selected = form.courses.includes(course._id);
                                            return (
                                                <label
                                                    key={course._id}
                                                    className={`fee-course-checkbox ${selected ? 'selected' : ''}`}
                                                    onClick={() => toggleCourse(course._id)}
                                                >
                                                    <div className="fee-course-checkbox__check">
                                                        {selected ? '✓' : ''}
                                                    </div>
                                                    <div className="fee-course-checkbox__info">
                                                        <span className="fee-course-checkbox__code">{course.code}</span>
                                                        <span className="fee-course-checkbox__title">{course.title}</span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}

                                {form.courses.length > 1 && (
                                    <p className="fee-multi-note">
                                        ℹ {form.courses.length} courses selected — a separate invoice will be created for each.
                                    </p>
                                )}
                            </div>

                            {/* ── Fee type + Title ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Fee type</label>
                                    <select className="form-input" name="feeType" value={form.feeType} onChange={handleChange}>
                                        {FEE_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                                {t.charAt(0).toUpperCase() + t.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Invoice title *</label>
                                    <input
                                        className="form-input"
                                        name="title"
                                        value={form.title}
                                        onChange={handleChange}
                                        placeholder="e.g. Semester 1 tuition fee"
                                    />
                                </div>
                            </div>

                            {/* ── Amount + Discount ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Total amount (LKR) *</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        name="totalAmount"
                                        value={form.totalAmount}
                                        onChange={handleChange}
                                        min={0}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Discount (LKR)</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        name="discount"
                                        value={form.discount}
                                        onChange={handleChange}
                                        min={0}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Net amount preview */}
                            {form.totalAmount && (
                                <div className="fee-net-preview">
                                    <span>Net amount payable:</span>
                                    <strong>{fmt(Number(form.totalAmount) - Number(form.discount || 0))}</strong>
                                </div>
                            )}

                            {/* ── Due date + Academic year ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Due date *</label>
                                    <input
                                        className="form-input"
                                        type="date"
                                        name="dueDate"
                                        value={form.dueDate}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Academic year</label>
                                    <input
                                        className="form-input"
                                        name="academicYear"
                                        value={form.academicYear}
                                        onChange={handleChange}
                                        placeholder="2024-2025"
                                    />
                                </div>
                            </div>

                            {/* ── Semester ── */}
                            <div className="form-group" style={{ maxWidth: 200 }}>
                                <label className="form-label">Semester</label>
                                <select className="form-input" name="semester" value={form.semester} onChange={handleChange}>
                                    {[1, 2, 3, 4, 5, 6].map((s) => (
                                        <option key={s} value={s}>Semester {s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving
                                        ? <><span className="spinner"></span> Creating…</>
                                        : form.courses.length > 1
                                            ? `Create ${form.courses.length} invoices`
                                            : 'Create invoice'
                                    }
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

            {/* ══ RECORD PAYMENT MODAL ══ */}
            {showPayment && (
                <div className="modal-overlay" onClick={() => setShowPayment(null)}>
                    <div
                        className="modal"
                        style={{ maxWidth: 440 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal__header">
                            <h2 className="modal__title">Record payment</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowPayment(null)}>✕</button>
                        </div>
                        <form className="modal__body" onSubmit={handlePayment}>

                            <div className="fee-payment-info">
                                <div>
                                    <p style={{ fontWeight: 600 }}>{showPayment.student?.name}</p>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                        {showPayment.title} · {showPayment.course?.code}
                                    </p>
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
                                        <option key={m} value={m}>
                                            {m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                        </option>
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
                                <button type="button" className="btn btn-ghost" onClick={() => setShowPayment(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={paymentSaving}>
                                    {paymentSaving
                                        ? <><span className="spinner"></span> Recording…</>
                                        : 'Record payment'
                                    }
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}