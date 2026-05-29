const PDFDocument = require('pdfkit');

const COLORS = {
    primary: '#4F46E5',
    dark: '#111827',
    muted: '#6B7280',
    border: '#E5E7EB',
    success: '#059669',
    error: '#DC2626',
    warning: '#D97706',
};

const addHeader = (doc, title, subtitle = '') => {
    doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('School ERP', 40, 24);
    doc.fontSize(11).font('Helvetica').text(title, 40, 50);
    doc.fillColor(COLORS.dark).moveDown(3);
    if (subtitle) {
        doc.fontSize(10).fillColor(COLORS.muted).text(subtitle, 40, doc.y);
        doc.moveDown(0.5);
    }
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke(COLORS.border);
    doc.moveDown(1);
};

const addTable = (doc, headers, rows, colWidths) => {
    const startX = 40;
    const rowH = 24;
    let y = doc.y;

    // Header row
    doc.rect(startX, y, doc.page.width - 80, rowH).fill('#F3F4F6');
    let x = startX;
    headers.forEach((h, i) => {
        doc.fillColor(COLORS.dark).fontSize(9).font('Helvetica-Bold')
            .text(h, x + 6, y + 7, { width: colWidths[i] - 8, lineBreak: false });
        x += colWidths[i];
    });
    y += rowH;

    // Data rows
    rows.forEach((row, rowIdx) => {
        if (y + rowH > doc.page.height - 60) {
            doc.addPage();
            y = 60;
        }
        if (rowIdx % 2 === 0) {
            doc.rect(startX, y, doc.page.width - 80, rowH).fill('#F9FAFB');
        }
        x = startX;
        row.forEach((cell, i) => {
            doc.fillColor(COLORS.dark).fontSize(9).font('Helvetica')
                .text(String(cell ?? '—'), x + 6, y + 7, { width: colWidths[i] - 8, lineBreak: false });
            x += colWidths[i];
        });
        y += rowH;
    });

    doc.moveTo(startX, y).lineTo(doc.page.width - 40, y).stroke(COLORS.border);
    doc.y = y + 16;
};

const addStatRow = (doc, stats) => {
    const boxW = Math.floor((doc.page.width - 80) / stats.length);
    let x = 40;
    const y = doc.y;
    stats.forEach(({ label, value, color }) => {
        doc.rect(x, y, boxW - 8, 52).fill('#F9FAFB').stroke(COLORS.border);
        doc.fillColor(color || COLORS.primary).fontSize(20).font('Helvetica-Bold')
            .text(String(value), x + 10, y + 8, { width: boxW - 28, align: 'center' });
        doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
            .text(label, x + 10, y + 34, { width: boxW - 28, align: 'center' });
        x += boxW;
    });
    doc.y = y + 68;
};

module.exports = { addHeader, addTable, addStatRow };