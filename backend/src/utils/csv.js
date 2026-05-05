// Minimal CSV serializer — no external dependency.
// Handles quoting, embedded commas, quotes, newlines.
function escapeCell(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows, columns) {
  if (!Array.isArray(rows)) return '';
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const header = cols.map(escapeCell).join(',');
  const lines = rows.map(r => cols.map(c => escapeCell(r[c])).join(','));
  // Prepend BOM so Excel detects UTF-8 (Hebrew renders correctly).
  return '﻿' + [header, ...lines].join('\r\n');
}

function sendCsv(res, filename, rows, columns) {
  const csv = rowsToCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { rowsToCsv, sendCsv, escapeCell };
