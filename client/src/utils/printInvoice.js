/**
 * Generates a styled HTML invoice and prints it via the browser print dialog.
 * No backend call needed — all data is already in the fee object.
 */

const STATUS_COLORS = {
    paid:    { bg: '#ECFDF5', color: '#059669', label: 'PAID' },
    partial: { bg: '#EFF6FF', color: '#2563EB', label: 'PARTIAL' },
    pending: { bg: '#FFFBEB', color: '#D97706', label: 'PENDING' },
    overdue: { bg: '#FEF2F2', color: '#DC2626', label: 'OVERDUE' },
    waived:  { bg: '#F9FAFB', color: '#6B7280', label: 'WAIVED'  },
};

const fmt = (n) => `LKR ${Number(n || 0).toLocaleString('en-LK')}`;

const fmtDate = (d) =>
    d
        ? new Date(d).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : '—';

const fmtDateTime = (d) =>
    d
        ? new Date(d).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })
        : '—';

const methodLabel = (m) =>
    (m || 'cash').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function printInvoice(fee) {
    const sc = STATUS_COLORS[fee.status] || STATUS_COLORS.pending;

    const paymentsRows =
        fee.payments && fee.payments.length > 0
            ? fee.payments
                .map(
                    (p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${fmtDateTime(p.paidAt)}</td>
            <td>${methodLabel(p.method)}</td>
            <td>${p.reference || '—'}</td>
            <td class="amount">${fmt(p.amount)}</td>
          </tr>`
                )
                .join('')
            : `<tr><td colspan="5" class="no-data">No payments recorded yet.</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invoice — ${fee.title}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #111827;
      background: #fff;
      padding: 0;
    }

    /* ── Page ── */
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 0;
      position: relative;
    }

    /* ── Header band ── */
    .header {
      background: #4F46E5;
      color: #fff;
      padding: 28px 40px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header__logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header__logo-icon {
      width: 44px;
      height: 44px;
      background: rgba(255,255,255,0.2);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      font-weight: 800;
      color: #fff;
    }

    .header__logo-text {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .header__logo-sub {
      font-size: 0.75rem;
      opacity: 0.75;
      margin-top: 2px;
    }

    .header__invoice {
      text-align: right;
    }

    .header__invoice-label {
      font-size: 0.75rem;
      opacity: 0.75;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .header__invoice-number {
      font-size: 1rem;
      font-weight: 700;
      margin-top: 4px;
      font-family: monospace;
      letter-spacing: 0.05em;
    }

    /* ── Status ribbon ── */
    .status-ribbon {
      display: flex;
      justify-content: flex-end;
      padding: 8px 40px;
      background: #F8F9FF;
      border-bottom: 1px solid #E5E7EB;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 16px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.06em;
    }

    .status-badge__dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }

    /* ── Body ── */
    .body {
      padding: 28px 40px;
    }

    /* ── Info grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }

    .info-block__label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: #6B7280;
      margin-bottom: 8px;
    }

    .info-block__row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8125rem;
      color: #374151;
      padding: 3px 0;
      border-bottom: 1px solid #F3F4F6;
    }

    .info-block__row:last-child { border-bottom: none; }

    .info-block__key   { color: #6B7280; }
    .info-block__value { font-weight: 600; text-align: right; }

    /* ── Amount summary bar ── */
    .amount-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 28px;
    }

    .amount-cell {
      padding: 14px 16px;
      border-right: 1px solid #E5E7EB;
      text-align: center;
    }

    .amount-cell:last-child { border-right: none; }

    .amount-cell__label {
      font-size: 0.7rem;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: 4px;
    }

    .amount-cell__value {
      font-size: 1.05rem;
      font-weight: 700;
      color: #111827;
    }

    .amount-cell__value.green  { color: #059669; }
    .amount-cell__value.red    { color: #DC2626; }
    .amount-cell__value.blue   { color: #2563EB; }
    .amount-cell__value.indigo { color: #4F46E5; }

    /* ── Progress bar ── */
    .progress-wrap {
      margin-bottom: 28px;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #6B7280;
      margin-bottom: 6px;
    }

    .progress-bar {
      height: 8px;
      background: #E5E7EB;
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 999px;
    }

    /* ── Section title ── */
    .section-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #4F46E5;
      display: inline-block;
    }

    /* ── Table ── */
    .payment-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
      margin-bottom: 28px;
    }

    .payment-table thead tr {
      background: #F3F4F6;
    }

    .payment-table th {
      padding: 8px 10px;
      text-align: left;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #374151;
    }

    .payment-table th.amount,
    .payment-table td.amount {
      text-align: right;
    }

    .payment-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #F3F4F6;
      color: #374151;
    }

    .payment-table tbody tr:last-child td { border-bottom: none; }
    .payment-table tbody tr:nth-child(even) { background: #F9FAFB; }

    .no-data {
      text-align: center;
      color: #9CA3AF;
      font-style: italic;
      padding: 16px !important;
    }

    /* ── Notes ── */
    .notes-box {
      background: #F8F9FF;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.8125rem;
      color: #374151;
      margin-bottom: 28px;
      line-height: 1.6;
    }

    /* ── Footer ── */
    .invoice-footer {
      border-top: 1px solid #E5E7EB;
      padding: 16px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #F8F9FF;
    }

    .invoice-footer__left {
      font-size: 0.75rem;
      color: #6B7280;
      line-height: 1.6;
    }

    .invoice-footer__right {
      text-align: right;
      font-size: 0.75rem;
      color: #6B7280;
    }

    .invoice-footer__stamp {
      font-size: 0.7rem;
      color: #9CA3AF;
      margin-top: 4px;
    }

    /* ── Watermark for PAID ── */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 5rem;
      font-weight: 900;
      color: rgba(5, 150, 105, 0.08);
      pointer-events: none;
      letter-spacing: 0.1em;
      white-space: nowrap;
      z-index: 0;
    }

    /* ── Print ── */
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${fee.status === 'paid' ? '<div class="watermark">PAID IN FULL</div>' : ''}

  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="header__logo">
        <div class="header__logo-icon">S</div>
        <div>
          <div class="header__logo-text">School ERP</div>
          <div class="header__logo-sub">Management System</div>
        </div>
      </div>
      <div class="header__invoice">
        <div class="header__invoice-label">Fee Invoice</div>
        <div class="header__invoice-number">#INV-${String(fee._id).slice(-8).toUpperCase()}</div>
        <div style="font-size:0.75rem;opacity:0.75;margin-top:4px;">
          Issued: ${fmtDate(fee.createdAt || new Date())}
        </div>
      </div>
    </div>

    <!-- Status ribbon -->
    <div class="status-ribbon">
      <div class="status-badge" style="background:${sc.bg};color:${sc.color};">
        <div class="status-badge__dot"></div>
        ${sc.label}
      </div>
    </div>

    <!-- Body -->
    <div class="body">

      <!-- Info grid -->
      <div class="info-grid">

        <!-- Student info -->
        <div>
          <div class="info-block__label">Student details</div>
          <div class="info-block__row">
            <span class="info-block__key">Name</span>
            <span class="info-block__value">${fee.student?.name || '—'}</span>
          </div>
          <div class="info-block__row">
            <span class="info-block__key">Email</span>
            <span class="info-block__value">${fee.student?.email || '—'}</span>
          </div>
          <div class="info-block__row">
            <span class="info-block__key">Course</span>
            <span class="info-block__value">${fee.course?.title || '—'}</span>
          </div>
          <div class="info-block__row">
            <span class="info-block__key">Course code</span>
            <span class="info-block__value">${fee.course?.code || '—'}</span>
          </div>
        </div>

        <!-- Invoice info -->
        <div>
          <div class="info-block__label">Invoice details</div>
          <div class="info-block__row">
            <span class="info-block__key">Title</span>
            <span class="info-block__value">${fee.title}</span>
          </div>
          <div class="info-block__row">
            <span class="info-block__key">Fee type</span>
            <span class="info-block__value" style="text-transform:capitalize;">${fee.feeType}</span>
          </div>
          <div class="info-block__row">
            <span class="info-block__key">Academic year</span>
            <span class="info-block__value">${fee.academicYear || '—'}</span>
          </div>
          <div class="info-block__row">
            <span class="info-block__key">Semester</span>
            <span class="info-block__value">Semester ${fee.semester || 1}</span>
          </div>
          <div class="info-block__row">
            <span class="info-block__key">Due date</span>
            <span class="info-block__value" style="color:${new Date(fee.dueDate) < new Date() && fee.status !== 'paid' ? '#DC2626' : '#111827'}">
              ${fmtDate(fee.dueDate)}
            </span>
          </div>
        </div>

      </div>

      <!-- Amount summary bar -->
      <div class="amount-bar">
        <div class="amount-cell">
          <div class="amount-cell__label">Total amount</div>
          <div class="amount-cell__value indigo">${fmt(fee.totalAmount)}</div>
        </div>
        <div class="amount-cell">
          <div class="amount-cell__label">Discount</div>
          <div class="amount-cell__value blue">${fmt(fee.discount)}</div>
        </div>
        <div class="amount-cell">
          <div class="amount-cell__label">Net payable</div>
          <div class="amount-cell__value" style="color:#111827;font-size:1.15rem;">${fmt(fee.netAmount)}</div>
        </div>
        <div class="amount-cell">
          <div class="amount-cell__label">Paid so far</div>
          <div class="amount-cell__value green">${fmt(fee.paidAmount)}</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="progress-wrap">
        <div class="progress-label">
          <span>Payment progress</span>
          <span>${fee.netAmount > 0 ? Math.min(100, Math.round((fee.paidAmount / fee.netAmount) * 100)) : 0}% paid</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="
              width: ${fee.netAmount > 0 ? Math.min(100, Math.round((fee.paidAmount / fee.netAmount) * 100)) : 0}%;
              background: ${fee.status === 'paid' ? '#059669' : fee.status === 'overdue' ? '#DC2626' : '#4F46E5'};
            "
          ></div>
        </div>
      </div>

      ${
        fee.netAmount - fee.paidAmount > 0
            ? `<div style="text-align:right;font-size:0.875rem;color:#DC2626;font-weight:700;margin-bottom:20px;">
               Balance due: ${fmt(fee.netAmount - fee.paidAmount)}
             </div>`
            : ''
    }

      <!-- Payment history -->
      <div class="section-title">Payment history</div>
      <table class="payment-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date & time</th>
            <th>Method</th>
            <th>Reference</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${paymentsRows}
        </tbody>
      </table>

      ${
        fee.notes
            ? `<div class="section-title">Notes</div>
             <div class="notes-box">${fee.notes}</div>`
            : ''
    }

    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="invoice-footer__left">
        <strong>School ERP</strong> · Management System<br/>
        123 School Lane, Colombo 03, Sri Lanka<br/>
        finance@school.lk · +94 11 234 5678
      </div>
      <div class="invoice-footer__right">
        <div>Invoice ID: <strong>#INV-${String(fee._id).slice(-8).toUpperCase()}</strong></div>
        <div class="invoice-footer__stamp">
          Printed: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
        <div class="invoice-footer__stamp" style="margin-top:6px;">
          This is a computer-generated invoice.
        </div>
      </div>
    </div>

  </div>
</body>
</html>`;

    // Open in a hidden iframe and trigger print
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for content + images to load, then print
    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            // Clean up after print dialog closes
            setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 300);
    };
}