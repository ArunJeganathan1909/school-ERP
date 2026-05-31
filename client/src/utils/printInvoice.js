import jsPDF from 'jspdf';
import html2canvas from "html2canvas";

const STATUS_COLORS = {
    paid:    { bg: '#ECFDF5', color: '#059669', label: 'PAID' },
    partial: { bg: '#EFF6FF', color: '#2563EB', label: 'PARTIAL' },
    pending: { bg: '#FFFBEB', color: '#D97706', label: 'PENDING' },
    overdue: { bg: '#FEF2F2', color: '#DC2626', label: 'OVERDUE' },
    waived:  { bg: '#F9FAFB', color: '#6B7280', label: 'WAIVED'  },
};

const fmt = (n) => `LKR ${Number(n || 0).toLocaleString('en-LK')}`;

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
    }) : '-';

const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }) : '-';

const methodLabel = (m) =>
    (m || 'cash').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const invoiceId = (fee) =>
    `INV-${String(fee._id).slice(-8).toUpperCase()}`;

function buildInvoiceHTML(fee) {
    const sc = STATUS_COLORS[fee.status] || STATUS_COLORS.pending;

    const paidPct =
        fee.netAmount > 0
            ? Math.min(100, Math.round((fee.paidAmount / fee.netAmount) * 100))
            : 0;

    const progressColor =
        fee.status === 'paid'    ? '#059669' :
            fee.status === 'overdue' ? '#DC2626' :
                '#4F46E5';

    const dueDateColor =
        new Date(fee.dueDate) < new Date() && fee.status !== 'paid'
            ? '#DC2626'
            : '#111827';

    const paymentsRows =
        fee.payments && fee.payments.length > 0
            ? fee.payments.map((p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${fmtDateTime(p.paidAt)}</td>
            <td>${methodLabel(p.method)}</td>
            <td>${p.reference || '—'}</td>
            <td class="amount">${fmt(p.amount)}</td>
          </tr>`).join('')
            : `<tr><td colspan="5" class="no-data">No payments recorded yet.</td></tr>`;

    return `<!DOCTYPE html>
            <html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #111827;
    background: #ffffff;
  }

  .page {
    width: 794px;          /* A4 at 96 dpi */
    min-height: 1123px;
    background: #fff;
    position: relative;
  }

  /* ── watermark ── */
  .watermark {
    position: absolute;
    top: 46%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 88px;
    font-weight: 900;
    color: rgba(5,150,105,0.07);
    pointer-events: none;
    letter-spacing: 0.1em;
    white-space: nowrap;
    z-index: 0;
  }

  /* ── header ── */
  .hdr {
    background: #4F46E5;
    color: #fff;
    padding: 26px 40px 22px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .hdr-logo { display: flex; align-items: center; gap: 12px; }
  .hdr-logo-icon {
    width: 42px; height: 42px;
    background: rgba(255,255,255,0.18);
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.3rem; font-weight: 800;
  }
  .hdr-logo-name { font-size: 1.15rem; font-weight: 800; }
  .hdr-logo-sub  { font-size: 0.7rem;  opacity: 0.7; margin-top: 2px; }
  .hdr-inv-label { font-size: 0.68rem; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.08em; }
  .hdr-inv-num   { font-size: 0.95rem; font-weight: 700; margin-top: 4px; font-family: monospace; letter-spacing: 0.04em; }
  .hdr-inv-date  { font-size: 0.7rem; opacity: 0.7; margin-top: 4px; }
  .hdr-right     { text-align: right; }

  /* ── status ribbon ── */
  .status-ribbon {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 7px 40px;
    background: #F8F9FF;
    border-bottom: 1px solid #E5E7EB;
    gap: 10px;
  }
  .status-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 14px;
    border-radius: 999px;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
  }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

  /* ── body ── */
  .body { padding: 26px 40px; position: relative; z-index: 1; }

  /* ── info grid ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-bottom: 22px; }
  .info-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: #6B7280; margin-bottom: 7px; }
  .info-row   { display: flex; justify-content: space-between; font-size: 0.78rem; color: #374151; padding: 3px 0; border-bottom: 1px solid #F3F4F6; }
  .info-row:last-child { border-bottom: none; }
  .info-key   { color: #6B7280; }
  .info-val   { font-weight: 600; text-align: right; }

  /* ── amount bar ── */
  .amt-bar {
    display: grid; grid-template-columns: repeat(4,1fr);
    border: 1px solid #E5E7EB; border-radius: 9px; overflow: hidden;
    margin-bottom: 18px;
  }
  .amt-cell { padding: 13px 14px; border-right: 1px solid #E5E7EB; text-align: center; }
  .amt-cell:last-child { border-right: none; }
  .amt-cell-label { font-size: 0.65rem; color: #6B7280; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 4px; }
  .amt-cell-value { font-size: 0.98rem; font-weight: 700; }

  /* ── progress ── */
  .prog-wrap { margin-bottom: 18px; }
  .prog-row  { display: flex; justify-content: space-between; font-size: 0.72rem; color: #6B7280; margin-bottom: 5px; }
  .prog-bar  { height: 7px; background: #E5E7EB; border-radius: 999px; overflow: hidden; }
  .prog-fill { height: 100%; border-radius: 999px; }

  .balance-due { text-align: right; font-size: 0.8rem; color: #DC2626; font-weight: 700; margin-bottom: 18px; }

  /* ── section title ── */
  .sec-title {
    font-size: 0.78rem; font-weight: 700; color: #111827;
    margin-bottom: 9px; padding-bottom: 5px;
    border-bottom: 2px solid #4F46E5; display: inline-block;
  }

  /* ── payments table ── */
  .pay-table { width: 100%; border-collapse: collapse; font-size: 0.77rem; margin-bottom: 22px; }
  .pay-table thead tr { background: #F3F4F6; }
  .pay-table th {
    padding: 7px 9px; text-align: left;
    font-size: 0.65rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em; color: #374151;
  }
  .pay-table th.amount,
  .pay-table td.amount { text-align: right; }
  .pay-table td { padding: 7px 9px; border-bottom: 1px solid #F3F4F6; color: #374151; }
  .pay-table tbody tr:last-child td { border-bottom: none; }
  .pay-table tbody tr:nth-child(even) { background: #F9FAFB; }
  .no-data { text-align: center; color: #9CA3AF; font-style: italic; padding: 14px !important; }

  /* ── notes ── */
  .notes-box {
    background: #F8F9FF; border: 1px solid #E5E7EB;
    border-radius: 7px; padding: 10px 14px;
    font-size: 0.77rem; color: #374151;
    margin-bottom: 22px; line-height: 1.6;
  }

  /* ── footer ── */
  .inv-footer {
    position: absolute; bottom: 0; left: 0; right: 0;
    border-top: 1px solid #E5E7EB;
    padding: 14px 40px;
    display: flex; justify-content: space-between; align-items: center;
    background: #F8F9FF;
  }
  .inv-footer-left  { font-size: 0.7rem; color: #6B7280; line-height: 1.6; }
  .inv-footer-right { text-align: right; font-size: 0.7rem; color: #6B7280; }
  .inv-footer-stamp { font-size: 0.65rem; color: #9CA3AF; margin-top: 3px; }
</style>
</head>
<body>
<div class="page">

  ${fee.status === 'paid' ? '<div class="watermark">PAID IN FULL</div>' : ''}

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-logo">
      <div class="hdr-logo-icon">S</div>
      <div>
        <div class="hdr-logo-name">School ERP</div>
        <div class="hdr-logo-sub">Management System</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="hdr-inv-label">Fee Invoice</div>
      <div class="hdr-inv-num">#${invoiceId(fee)}</div>
      <div class="hdr-inv-date">Issued: ${fmtDate(fee.createdAt || new Date())}</div>
    </div>
  </div>

  <!-- Status ribbon -->
  <div class="status-ribbon">
    <div class="status-badge" style="background:${sc.bg};color:${sc.color};">
      <div class="status-dot"></div>
      ${sc.label}
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Info grid -->
    <div class="info-grid">
      <div>
        <div class="info-label">Student details</div>
        <div class="info-row"><span class="info-key">Name</span>        <span class="info-val">${fee.student?.name || '—'}</span></div>
        <div class="info-row"><span class="info-key">Email</span>       <span class="info-val">${fee.student?.email || '—'}</span></div>
        <div class="info-row"><span class="info-key">Course</span>      <span class="info-val">${fee.course?.title || '—'}</span></div>
        <div class="info-row"><span class="info-key">Course code</span> <span class="info-val">${fee.course?.code || '—'}</span></div>
      </div>
      <div>
        <div class="info-label">Invoice details</div>
        <div class="info-row"><span class="info-key">Title</span>         <span class="info-val">${fee.title}</span></div>
        <div class="info-row"><span class="info-key">Fee type</span>      <span class="info-val" style="text-transform:capitalize">${fee.feeType}</span></div>
        <div class="info-row"><span class="info-key">Academic year</span> <span class="info-val">${fee.academicYear || '—'}</span></div>
        <div class="info-row"><span class="info-key">Semester</span>      <span class="info-val">Semester ${fee.semester || 1}</span></div>
        <div class="info-row"><span class="info-key">Due date</span>      <span class="info-val" style="color:${dueDateColor}">${fmtDate(fee.dueDate)}</span></div>
      </div>
    </div>

    <!-- Amount bar -->
    <div class="amt-bar">
      <div class="amt-cell">
        <div class="amt-cell-label">Total amount</div>
        <div class="amt-cell-value" style="color:#4F46E5">${fmt(fee.totalAmount)}</div>
      </div>
      <div class="amt-cell">
        <div class="amt-cell-label">Discount</div>
        <div class="amt-cell-value" style="color:#2563EB">${fmt(fee.discount)}</div>
      </div>
      <div class="amt-cell">
        <div class="amt-cell-label">Net payable</div>
        <div class="amt-cell-value" style="color:#111827;font-size:1.05rem">${fmt(fee.netAmount)}</div>
      </div>
      <div class="amt-cell">
        <div class="amt-cell-label">Paid so far</div>
        <div class="amt-cell-value" style="color:#059669">${fmt(fee.paidAmount)}</div>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="prog-wrap">
      <div class="prog-row">
        <span>Payment progress</span>
        <span>${paidPct}% paid</span>
      </div>
      <div class="prog-bar">
        <div class="prog-fill" style="width:${paidPct}%;background:${progressColor}"></div>
      </div>
    </div>

    ${fee.netAmount - fee.paidAmount > 0
        ? `<div class="balance-due">Balance due: ${fmt(fee.netAmount - fee.paidAmount)}</div>`
        : ''
    }

    <!-- Payment history -->
    <div class="sec-title">Payment history</div>
    <table class="pay-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Date &amp; time</th>
          <th>Method</th>
          <th>Reference</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>${paymentsRows}</tbody>
    </table>

    ${fee.notes
        ? `<div class="sec-title">Notes</div><div class="notes-box">${fee.notes}</div>`
        : ''
    }

  </div>

  <!-- Footer -->
  <div class="inv-footer">
    <div class="inv-footer-left">
      <strong>School ERP</strong> · Management System<br/>
      123 School Lane, Colombo 03, Sri Lanka<br/>
      finance@school.lk &nbsp;·&nbsp; +94 11 234 5678
    </div>
    <div class="inv-footer-right">
      <div>Invoice: <strong>#${invoiceId(fee)}</strong></div>
      <div class="inv-footer-stamp">Printed: ${new Date().toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
    })}</div>
      <div class="inv-footer-stamp" style="margin-top:4px">This is a computer-generated invoice.</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─── PRINT (browser print dialog) ────────────────────────────────────────────

export function printInvoice(fee) {
    const html = buildInvoiceHTML(fee);

    const iframe = document.createElement('iframe');
    iframe.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 300);
    };
}

// ─── DOWNLOAD PDF ────────────────────────────────────────────────────────────

export async function downloadInvoicePDF(fee, setDownloading) {
    if (setDownloading) setDownloading(true);

    try {
        const html = buildInvoiceHTML(fee);

    //     Render HTML into a hidden off-screen div
        const container = document.createElement('div');
        container.style.cssText = `
          position: fixed;
          top: -99999px;
          left: -99999px;
          width: 794px;
          background: #ffffff;
          font-family: Arial, Helvetica, sans-serif;
          z-index: -1;
        `;
        container.innerHTML = html;
        document.body.appendChild(container);

    //     Wait for fonts/layout to settle
        await new Promise((r) => setTimeout(r, 400));

    //     Capture with html2canvas
        const canvas = await html2canvas(container.querySelector('.page'), {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 794,
        });

        document.body.removeChild(container);

        // Build PDF (A4 = 210 × 297 mm)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pageWidth  = pdf.internal.pageSize.getWidth();   // 210
        const pageHeight = pdf.internal.pageSize.getHeight();  // 297

        const imgWidth  = pageWidth;
        const imgHeight = (canvas.height * pageWidth) / canvas.width;

        const imgData = canvas.toDataURL('image/png', 1.0);

        // If the content is taller than one page, split across pages
        if (imgHeight <= pageHeight) {
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        } else {
            let yOffset = 0;
            let remaining = imgHeight;

            while (remaining > 0) {
                const sliceHeight = Math.min(pageHeight, remaining);

                // Create a slice canvas
                const sliceCanvas = document.createElement('canvas');
                const dpr = 2; // matches scale above
                sliceCanvas.width  = canvas.width;
                sliceCanvas.height = Math.round((sliceHeight / imgHeight) * canvas.height);

                const ctx = sliceCanvas.getContext('2d');
                ctx.drawImage(
                    canvas,
                    0,
                    Math.round((yOffset / imgHeight) * canvas.height),
                    canvas.width,
                    sliceCanvas.height,
                    0, 0,
                    canvas.width,
                    sliceCanvas.height,
                );

                const sliceData = sliceCanvas.toDataURL('image/png', 1.0);

                if (yOffset > 0) pdf.addPage();
                pdf.addImage(sliceData, 'PNG', 0, 0, imgWidth, sliceHeight);

                yOffset    += sliceHeight;
                remaining  -= sliceHeight;
            }
        }

        // Download
        const fileName = `Invoice-${invoiceId(fee)}-${fee.student?.name?.replace(/\s+/g, '-') || 'student'}.pdf`;
        pdf.save(fileName);

    } catch (error) {
        console.error('PDF download failed:', error);
        alert('PDF download failed. Please try again.');
    } finally {
        if (setDownloading) setDownloading(false);
    }
}