import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import {
    fetchAllFees,
    createFee,
    createSectionFees,
    recordPayment,
    deleteFee,
    clearBulkResult,
} from '../../store/slices/feeSlice';
import api from '../../api/axios';
import './ManageFees.css';
import { printInvoice, downloadInvoicePDF } from "../../utils/printInvoice";

const FEE_TYPES = ['tuition', 'exam', 'library', 'lab', 'transport', 'hostel', 'other'];

const STATUS_STYLES = {
    pending: { bg: '#FFFBEB', color: '#D97706' },
    partial: { bg: '#EFF6FF', color: '#2563EB' },
    paid:    { bg: '#ECFDF5', color: '#059669' },
    overdue: { bg: '#FEF2F2', color: '#DC2626' },
    waived:  { bg: '#F9FAFB', color: '#6B7280' },
};

const EMPTY_FEE_DETAILS = {
    feeType:      'tuition',
    title:        '',
    totalAmount:  '',
    discount:     0,
    dueDate:      '',
    semester:     1,
};

export default function ManageFees() {
    const dispatch = useDispatch();
    const { list: fees, stats, total, loading, error, bulkResult, bulkLoading, bulkError } = useSelector((s) => s.fees);

    const [statusFilter, setStatusFilter] = useState('');

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [createMode, setCreateMode] = useState('section'); // 'section' | 'student'
    const [details, setDetails]       = useState(EMPTY_FEE_DETAILS);
    const [saving, setSaving]         = useState(false);
    const [formError, setFormError]   = useState('');

    // ── Section mode: grade → section cascading select ──
    const [grades, setGrades]           = useState([]);
    const [sections, setSections]       = useState([]);
    const [selectedGrade, setSelectedGrade]     = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [sectionsLoading, setSectionsLoading] = useState(false);

    // ── Student mode: student search ──
    const [studentSearch,   setStudentSearch]   = useState('');
    const [studentResults,  setStudentResults]  = useState([]);
    const [studentLoading,  setStudentLoading]  = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showDropdown,    setShowDropdown]    = useState(false);
    const searchRef  = useRef(null);
    const debounceRef = useRef(null);

    // Active section for the selected student (read-only, informational)
    const [studentSection, setStudentSection]     = useState(null);
    const [studentSectionLoading, setStudentSectionLoading] = useState(false);

    // Payment modal
    const [showPayment,  setShowPayment]  = useState(null);
    const [paymentForm,  setPaymentForm]  = useState({ amount: '', method: 'cash', reference: '' });
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);

    /* ── initial load ── */
    useEffect(() => {
        dispatch(fetchAllFees({ limit: 30 }));
    }, [dispatch]);

    useEffect(() => {
        const params = { limit: 30 };
        if (statusFilter) params.status = statusFilter;
        dispatch(fetchAllFees(params));
    }, [dispatch, statusFilter]);

    /* ── load grades once ── */
    useEffect(() => {
        api.get('/grades')
            .then(({ data }) => setGrades(data.grades || []))
            .catch(() => setGrades([]));
    }, []);

    /* ── load sections whenever grade changes ── */
    useEffect(() => {
        if (!selectedGrade) { setSections([]); setSelectedSection(''); return; }
        setSectionsLoading(true);
        api.get(`/sections?grade=${selectedGrade}`)
            .then(({ data }) => setSections(data.sections || []))
            .catch(() => setSections([]))
            .finally(() => setSectionsLoading(false));
    }, [selectedGrade]);

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

        if (selectedStudent && value !== selectedStudent.name) {
            setSelectedStudent(null);
            setStudentSection(null);
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

        // Look up the student's current active section (read-only context —
        // the fee will be billed against whatever section they're in).
        setStudentSectionLoading(true);
        try {
            const { data } = await api.get(
                `/student-sections?student=${student._id}&status=active&limit=1`
            );
            const ss = (data.studentSections || [])[0] || null;
            setStudentSection(ss);
        } catch (err) {
            console.error('Failed to load active section:', err);
            setStudentSection(null);
        }
        setStudentSectionLoading(false);
    };

    /* ── handle fee-detail form fields (shared by both modes) ── */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setDetails((f) => ({ ...f, [name]: value }));
    };

    /* ── open create modal ── */
    const openCreate = () => {
        setDetails(EMPTY_FEE_DETAILS);
        setCreateMode('section');
        setSelectedGrade('');
        setSelectedSection('');
        setSelectedStudent(null);
        setStudentSearch('');
        setStudentSection(null);
        setFormError('');
        dispatch(clearBulkResult());
        setShowCreate(true);
    };

    /* ── submit: generate the same invoice for every active student in a section ── */
    const handleCreateSection = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!selectedSection) {
            setFormError('Please select a grade and section.');
            return;
        }
        if (!details.title || !details.totalAmount || !details.dueDate) {
            setFormError('Title, amount, and due date are required.');
            return;
        }

        setSaving(true);
        const result = await dispatch(createSectionFees({
            section:     selectedSection,
            feeType:     details.feeType,
            title:       details.title,
            totalAmount: Number(details.totalAmount),
            discount:    Number(details.discount) || 0,
            dueDate:     details.dueDate,
            semester:    Number(details.semester),
        }));
        setSaving(false);

        if (createSectionFees.rejected.match(result)) {
            setFormError(result.payload || 'Failed to create invoices');
            return;
        }

        setShowCreate(false);
        const params = { limit: 30 };
        if (statusFilter) params.status = statusFilter;
        dispatch(fetchAllFees(params));
    };

    /* ── submit: single ad-hoc invoice for one student ── */
    const handleCreateStudent = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!selectedStudent) {
            setFormError('Please select a student.');
            return;
        }
        if (!studentSection) {
            setFormError('This student has no active section, so an invoice cannot be billed to them.');
            return;
        }
        if (!details.title || !details.totalAmount || !details.dueDate) {
            setFormError('Title, amount, and due date are required.');
            return;
        }

        setSaving(true);
        const result = await dispatch(createFee({
            student:     selectedStudent._id,
            section:     studentSection.section?._id || studentSection.section,
            feeType:     details.feeType,
            title:       details.title,
            totalAmount: Number(details.totalAmount),
            discount:    Number(details.discount) || 0,
            dueDate:     details.dueDate,
            semester:    Number(details.semester),
        }));
        setSaving(false);

        if (createFee.rejected.match(result)) {
            setFormError(result.payload || 'Failed to create invoice');
            return;
        }

        setShowCreate(false);
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

    const sectionLabel = (section) =>
        section ? `${section.grade?.name || 'Grade'} ${section.name}` : '—';

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
                                    <th>Section</th>
                                    <th>Term</th>
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
                                        <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
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
                                            <td style={{ color: 'var(--color-text-secondary)' }}>
                                                {sectionLabel(fee.section)}
                                            </td>
                                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                                                {fee.academicYear?.name || '—'}<br />Sem {fee.semester}
                                            </td>
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
                                                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', alignItems: 'center' }}>

                                                    {/* Print */}
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => printInvoice(fee)}
                                                        title="Print invoice"
                                                        style={{ fontSize: '0.9rem', padding: '5px 8px' }}
                                                    >
                                                        🖨
                                                    </button>

                                                    {/* Download PDF */}
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() =>
                                                            downloadInvoicePDF(fee, (loading) =>
                                                                setDownloadingId(loading ? fee._id : null)
                                                            )
                                                        }
                                                        disabled={downloadingId === fee._id}
                                                        title="Download PDF"
                                                        style={{ fontSize: '0.9rem', padding: '5px 8px' }}
                                                    >
                                                        {downloadingId === fee._id
                                                            ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
                                                            : '⬇'}
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

                        {/* Mode toggle */}
                        <div className="course-list__status-tabs" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                            <button
                                type="button"
                                className={`course-status-tab ${createMode === 'section' ? 'active' : ''}`}
                                onClick={() => { setCreateMode('section'); setFormError(''); }}
                            >
                                Whole section (recurring)
                            </button>
                            <button
                                type="button"
                                className={`course-status-tab ${createMode === 'student' ? 'active' : ''}`}
                                onClick={() => { setCreateMode('student'); setFormError(''); }}
                            >
                                Single student
                            </button>
                        </div>

                        {formError && (
                            <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                                {formError}
                            </div>
                        )}
                        {bulkError && createMode === 'section' && (
                            <div className="alert alert-error" style={{ margin: '0 var(--space-lg) var(--space-sm)' }}>
                                {bulkError}
                            </div>
                        )}

                        <form
                            className="modal__body"
                            onSubmit={createMode === 'section' ? handleCreateSection : handleCreateStudent}
                        >
                            {createMode === 'section' ? (
                                <>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 0 }}>
                                        Creates the same invoice for every active student in the section — use this
                                        each semester for tuition, exam fees, etc.
                                    </p>

                                    {/* ── Grade + Section ── */}
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Grade *</label>
                                            <select
                                                className="form-input"
                                                value={selectedGrade}
                                                onChange={(e) => setSelectedGrade(e.target.value)}
                                            >
                                                <option value="">Select grade…</option>
                                                {grades.map((g) => (
                                                    <option key={g._id} value={g._id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Section *</label>
                                            <select
                                                className="form-input"
                                                value={selectedSection}
                                                onChange={(e) => setSelectedSection(e.target.value)}
                                                disabled={!selectedGrade || sectionsLoading}
                                            >
                                                <option value="">
                                                    {sectionsLoading ? 'Loading…' : 'Select section…'}
                                                </option>
                                                {sections.map((s) => (
                                                    <option key={s._id} value={s._id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
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

                                        {selectedStudent && (
                                            <div className="fee-selected-student">
                                                <div className="fee-selected-student__avatar">
                                                    {initials(selectedStudent.name)}
                                                </div>
                                                <div className="fee-selected-student__info">
                                                    <span className="fee-selected-student__name">{selectedStudent.name}</span>
                                                    <span className="fee-selected-student__email">
                                                        {studentSectionLoading
                                                            ? 'Loading section…'
                                                            : studentSection
                                                                ? sectionLabel(studentSection.section)
                                                                : 'No active section — cannot bill'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="fee-selected-student__remove"
                                                    onClick={() => {
                                                        setSelectedStudent(null);
                                                        setStudentSearch('');
                                                        setStudentSection(null);
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* ── Fee type + Title ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Fee type</label>
                                    <select className="form-input" name="feeType" value={details.feeType} onChange={handleChange}>
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
                                        value={details.title}
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
                                        value={details.totalAmount}
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
                                        value={details.discount}
                                        onChange={handleChange}
                                        min={0}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Net amount preview */}
                            {details.totalAmount && (
                                <div className="fee-net-preview">
                                    <span>Net amount payable{createMode === 'section' ? ' (per student)' : ''}:</span>
                                    <strong>{fmt(Number(details.totalAmount) - Number(details.discount || 0))}</strong>
                                </div>
                            )}

                            {/* ── Due date + Semester ── */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Due date *</label>
                                    <input
                                        className="form-input"
                                        type="date"
                                        name="dueDate"
                                        value={details.dueDate}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Semester</label>
                                    <select className="form-input" name="semester" value={details.semester} onChange={handleChange}>
                                        {[1, 2, 3, 4].map((s) => (
                                            <option key={s} value={s}>Semester {s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                Academic year is taken automatically from the {createMode === 'section' ? 'section' : "student's active section"}.
                            </p>

                            <div className="modal__footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving || bulkLoading}>
                                    {saving || bulkLoading
                                        ? <><span className="spinner"></span> Creating…</>
                                        : createMode === 'section'
                                            ? 'Generate for section'
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
                                        {showPayment.title} · {sectionLabel(showPayment.section)}
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