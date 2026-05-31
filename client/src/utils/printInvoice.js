import jsPDF from 'jspdf';

// ─── shared data ─────────────────────────────────────────────────────────────

const STATUS_META = {
    paid:    { label: 'PAID',    r: 5,   g: 150, b: 105 },
    partial: { label: 'PARTIAL', r: 37,  g: 99,  b: 235 },
    pending: { label: 'PENDING', r: 217, g: 119, b: 6   },
    overdue: { label: 'OVERDUE', r: 220, g: 38,  b: 38  },
    waived:  { label: 'WAIVED',  r: 107, g: 114, b: 128 },
};

const fmt = (n) =>
    `LKR ${Number(n || 0).toLocaleString('en-LK')}`;

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
    }) : '—';

const fmtDateShort = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    }) : '—';

const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }) : '—';

const methodLabel = (m) =>
    (m || 'cash').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

const invId = (fee) =>
    `INV-${String(fee._id).slice(-8).toUpperCase()}`;

// ─── jsPDF helper wrappers ────────────────────────────────────────────────────

// Draw a filled rounded rectangle
function roundRect(doc, x, y, w, h, r, fillR, fillG, fillB) {
    doc.setFillColor(fillR, fillG, fillB);
    doc.roundedRect(x, y, w, h, r, r, 'F');
}

// Draw a border-only rounded rectangle
function roundRectBorder(doc, x, y, w, h, r, borderR, borderG, borderB, lw = 0.3) {
    doc.setDrawColor(borderR, borderG, borderB);
    doc.setLineWidth(lw);
    doc.roundedRect(x, y, w, h, r, r, 'S');
}

// Draw text with colour
function text(doc, str, x, y, size, r, g, b, style = 'normal', align = 'left') {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(r, g, b);
    doc.text(String(str ?? '—'), x, y, { align });
}

// Horizontal line
function hLine(doc, x1, x2, y, r = 229, g = 231, b = 235, lw = 0.25) {
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(lw);
    doc.line(x1, y, x2, y);
}

// ─── BUILD PDF ────────────────────────────────────────────────────────────────

function buildPDF(fee) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PW = 210;   // page width  mm
    const PH = 297;   // page height mm
    const ML = 14;    // margin left
    const MR = 196;   // margin right  (PW - 14)
    const CW = MR - ML; // content width

    const sm = STATUS_META[fee.status] || STATUS_META.pending;

    // ── HEADER BAND ──────────────────────────────────────────────────────────
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, PW, 28, 'F');

    // Logo box
    roundRect(doc, ML, 5, 12, 12, 2, 255, 255, 255);
    text(doc, 'S', ML + 6, 13, 10, 79, 70, 229, 'bold', 'center');

    // School name
    text(doc, 'School ERP',          ML + 15, 11, 11, 255, 255, 255, 'bold');
    text(doc, 'Management System',   ML + 15, 16,  7, 200, 196, 255, 'normal');

    // Invoice ID (right aligned)
    text(doc, 'FEE INVOICE',             MR, 9,  7, 200, 196, 255, 'normal', 'right');
    text(doc, `#${invId(fee)}`,          MR, 14, 9, 255, 255, 255, 'bold',   'right');
    text(doc, `Issued: ${fmtDate(fee.createdAt || new Date())}`, MR, 19, 6.5, 200, 196, 255, 'normal', 'right');

    // ── STATUS BADGE ─────────────────────────────────────────────────────────
    let y = 32;
    const badgeW = 28;
    const badgeX = MR - badgeW;
    roundRect(doc, badgeX, y, badgeW, 7, 3, sm.r, sm.g, sm.b);
    // lighten badge (add white overlay effect by using alpha-like light color)
    doc.setFillColor(sm.r, sm.g, sm.b);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(sm.label, badgeX + badgeW / 2, y + 4.8, { align: 'center' });

    // ── TWO-COLUMN INFO GRID ──────────────────────────────────────────────────
    y = 44;
    const colMid = ML + CW / 2 + 3;

    // Left column header
    text(doc, 'STUDENT DETAILS', ML, y, 6.5, 107, 114, 128, 'bold');
    // Right column header
    text(doc, 'INVOICE DETAILS', colMid, y, 6.5, 107, 114, 128, 'bold');

    const rows = [
        ['Name',         fee.student?.name    || '—', 'Title',         fee.title],
        ['Email',        fee.student?.email   || '—', 'Fee type',      (fee.feeType || '').replace(/\b\w/g, c => c.toUpperCase())],
        ['Course',       fee.course?.title    || '—', 'Academic year', fee.academicYear || '—'],
        ['Course code',  fee.course?.code     || '—', 'Semester',      `Semester ${fee.semester || 1}`],
        ['',             '',                          'Due date',      fmtDate(fee.dueDate)],
    ];

    let ry = y + 5;
    const rowH = 6.5;
    rows.forEach(([lKey, lVal, rKey, rVal]) => {
        if (lKey) {
            text(doc, lKey,  ML,            ry, 7.5, 107, 114, 128, 'normal');
            text(doc, lVal,  ML + CW / 2 - 4, ry, 7.5,  17,  24,  39, 'bold', 'right');
        }
        if (rKey) {
            text(doc, rKey,  colMid,        ry, 7.5, 107, 114, 128, 'normal');
            // Due date in red if overdue
            const isDuePast = rKey === 'Due date' && new Date(fee.dueDate) < new Date() && fee.status !== 'paid';
            text(doc, rVal,  MR,            ry, 7.5, isDuePast ? 220 : 17, isDuePast ? 38 : 24, isDuePast ? 38 : 39, 'bold', 'right');
        }
        hLine(doc, ML, MR, ry + 1.5);
        ry += rowH;
    });

    // ── AMOUNT BAR ────────────────────────────────────────────────────────────
    y = ry + 6;
    roundRectBorder(doc, ML, y, CW, 20, 3, 229, 231, 235);

    const cells = [
        { label: 'TOTAL AMOUNT', value: fmt(fee.totalAmount), r: 79,  g: 70,  b: 229 },
        { label: 'DISCOUNT',     value: fmt(fee.discount),     r: 37,  g: 99,  b: 235 },
        { label: 'NET PAYABLE',  value: fmt(fee.netAmount),    r: 17,  g: 24,  b: 39  },
        { label: 'PAID SO FAR',  value: fmt(fee.paidAmount),   r: 5,   g: 150, b: 105 },
    ];

    const cellW = CW / 4;
    cells.forEach((cell, i) => {
        const cx = ML + i * cellW + cellW / 2;
        text(doc, cell.label, cx, y + 5,  5.5, 107, 114, 128, 'normal', 'center');
        text(doc, cell.value, cx, y + 13, 7.5, cell.r, cell.g, cell.b, 'bold', 'center');
        if (i < 3) {
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(ML + (i + 1) * cellW, y + 1, ML + (i + 1) * cellW, y + 19);
        }
    });

    // ── PROGRESS BAR ─────────────────────────────────────────────────────────
    y += 26;
    const paidPct = fee.netAmount > 0
        ? Math.min(100, Math.round((fee.paidAmount / fee.netAmount) * 100))
        : 0;

    const barR = fee.status === 'paid' ? 5 : fee.status === 'overdue' ? 220 : 79;
    const barG = fee.status === 'paid' ? 150 : fee.status === 'overdue' ? 38  : 70;
    const barB = fee.status === 'paid' ? 105 : fee.status === 'overdue' ? 38  : 229;

    text(doc, 'Payment progress', ML,  y, 7, 107, 114, 128, 'normal');
    text(doc, `${paidPct}% paid`,  MR, y, 7, 107, 114, 128, 'normal', 'right');

    y += 3;
    // background track
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(ML, y, CW, 3.5, 1.5, 1.5, 'F');
    // fill
    if (paidPct > 0) {
        doc.setFillColor(barR, barG, barB);
        doc.roundedRect(ML, y, CW * paidPct / 100, 3.5, 1.5, 1.5, 'F');
    }

    // balance due
    y += 8;
    const balance = (fee.netAmount || 0) - (fee.paidAmount || 0);
    if (balance > 0) {
        text(doc, `Balance due: ${fmt(balance)}`, MR, y, 8, 220, 38, 38, 'bold', 'right');
        y += 5;
    }

    // ── PAYMENT HISTORY TABLE ─────────────────────────────────────────────────
    y += 4;
    text(doc, 'PAYMENT HISTORY', ML, y, 7.5, 17, 24, 39, 'bold');
    // underline
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(ML, y + 1, ML + 38, y + 1);

    y += 5;

    // Table header
    doc.setFillColor(243, 244, 246);
    doc.rect(ML, y, CW, 7, 'F');

    const cols = [
        { label: '#',           x: ML + 3,   w: 8  },
        { label: 'DATE & TIME', x: ML + 11,  w: 46 },
        { label: 'METHOD',      x: ML + 57,  w: 32 },
        { label: 'REFERENCE',   x: ML + 89,  w: 52 },
        { label: 'AMOUNT',      x: MR - 2,   w: 28, align: 'right' },
    ];

    cols.forEach(col => {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        doc.text(col.label, col.x, y + 4.5, { align: col.align || 'left' });
    });
    hLine(doc, ML, MR, y + 7, 209, 213, 219);

    y += 7;

    if (!fee.payments || fee.payments.length === 0) {
        text(doc, 'No payments recorded yet.', ML + CW / 2, y + 6, 8, 156, 163, 175, 'normal', 'center');
        y += 12;
    } else {
        fee.payments.forEach((p, i) => {
            // zebra
            if (i % 2 === 0) {
                doc.setFillColor(249, 250, 251);
                doc.rect(ML, y, CW, 7, 'F');
            }

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(55, 65, 81);

            doc.text(String(i + 1),              cols[0].x, y + 4.5);
            doc.text(fmtDateTime(p.paidAt),      cols[1].x, y + 4.5);
            doc.text(methodLabel(p.method),      cols[2].x, y + 4.5);
            doc.text(p.reference || '—',         cols[3].x, y + 4.5);

            // Amount in green
            doc.setTextColor(5, 150, 105);
            doc.setFont('helvetica', 'bold');
            doc.text(fmt(p.amount), cols[4].x, y + 4.5, { align: 'right' });

            hLine(doc, ML, MR, y + 7, 229, 231, 235);
            y += 7;
        });
    }

    // ── NOTES (if any) ────────────────────────────────────────────────────────
    if (fee.notes) {
        y += 4;
        text(doc, 'NOTES', ML, y, 7.5, 17, 24, 39, 'bold');
        doc.setDrawColor(79, 70, 229);
        doc.setLineWidth(0.5);
        doc.line(ML, y + 1, ML + 14, y + 1);
        y += 5;

        doc.setFillColor(248, 249, 255);
        roundRectBorder(doc, ML, y, CW, 12, 2, 229, 231, 235);
        text(doc, fee.notes, ML + 4, y + 7, 7.5, 55, 65, 81, 'normal');
        y += 16;
    }

    // ── PAID WATERMARK ────────────────────────────────────────────────────────
    if (fee.status === 'paid') {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.06 }));
        doc.setTextColor(5, 150, 105);
        doc.setFontSize(60);
        doc.setFont('helvetica', 'bold');
        doc.text('PAID IN FULL', PW / 2, PH / 2, {
            align: 'center',
            angle: 35,
        });
        doc.restoreGraphicsState();
    }

    // ── FOOTER BAND ───────────────────────────────────────────────────────────
    doc.setFillColor(248, 249, 255);
    doc.rect(0, PH - 22, PW, 22, 'F');
    hLine(doc, 0, PW, PH - 22, 229, 231, 235, 0.25);

    // Left: school contact
    text(doc, 'School ERP · Management System',        ML, PH - 16, 7,   17,  24,  39, 'bold');
    text(doc, '123 School Lane, Colombo 03, Sri Lanka', ML, PH - 11, 6.5, 107, 114, 128, 'normal');
    text(doc, 'finance@school.lk  ·  +94 11 234 5678', ML, PH - 6,  6.5, 107, 114, 128, 'normal');

    // Right: invoice ref + print time
    text(doc, `Invoice: #${invId(fee)}`,         MR, PH - 16, 7,   17,  24,  39,  'bold',   'right');
    text(doc, `Printed: ${fmtDateTime(new Date())}`, MR, PH - 11, 6,  107, 114, 128, 'normal', 'right');
    text(doc, 'This is a computer-generated invoice.',  MR, PH - 6,  6,  156, 163, 175, 'normal', 'right');

    return doc;
}

// ─── PUBLIC: PRINT ────────────────────────────────────────────────────────────

export function printInvoice(fee) {
    const doc   = buildPDF(fee);
    const blob  = doc.output('blob');
    const url   = URL.createObjectURL(blob);

    // Open in hidden iframe and trigger print dialog
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    iframe.src = url;
    document.body.appendChild(iframe);

    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(url);
            }, 2000);
        }, 300);
    };
}

// ─── PUBLIC: DOWNLOAD ─────────────────────────────────────────────────────────

export async function downloadInvoicePDF(fee, setDownloading) {
    if (setDownloading) setDownloading(true);
    try {
        const doc      = buildPDF(fee);
        const fileName = `Invoice-${invId(fee)}-${(fee.student?.name || 'student').replace(/\s+/g, '-')}.pdf`;
        doc.save(fileName);
    } catch (err) {
        console.error('PDF download error:', err);
        alert('PDF download failed: ' + err.message);
    } finally {
        if (setDownloading) setDownloading(false);
    }
}