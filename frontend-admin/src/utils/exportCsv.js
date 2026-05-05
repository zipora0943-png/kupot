// Client-side CSV export. Designed for Excel:
//   - UTF-8 BOM so Hebrew renders correctly when the file is opened in Excel.
//   - CRLF line endings.
//   - Fields are quoted only when needed (contain comma / quote / newline).

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // collapse newlines inside cells so a single record stays on one line
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * Build a CSV string from an array of plain objects.
 *
 * @param {Array<object>} rows
 * @param {Array<{key: string, label: string, format?: (val, row) => any}>} columns
 *   Each column maps a row key (or computed value via `format`) to a display label.
 * @returns {string} CSV text (with BOM)
 */
export function buildCsv(rows, columns) {
  const header = columns.map(c => csvEscape(c.label)).join(',')
  const lines = (rows || []).map(row =>
    columns.map(c => {
      const raw = c.format ? c.format(row[c.key], row) : row[c.key]
      return csvEscape(raw)
    }).join(',')
  )
  return '﻿' + [header, ...lines].join('\r\n')
}

/**
 * Trigger a browser download of the given CSV text as a file.
 *
 * @param {string} csv
 * @param {string} filename — e.g. "envelopes_2026-05-03.csv"
 */
export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // give the browser a tick to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Convenience: build + download in one call.
 */
export function exportCsv(rows, columns, filename) {
  downloadCsv(buildCsv(rows, columns), filename)
}

/**
 * Build a date-stamped filename like "tasks_2026-05-03.csv".
 */
export function csvFilename(prefix) {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${prefix}_${yyyy}-${mm}-${dd}.csv`
}
