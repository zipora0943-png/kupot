import React, { useEffect, useMemo, useState } from 'react'
import { imports as importsApi } from '../api/endpoints'

// Status pill colors per row classification.
const STATUS_STYLES = {
  ok:        { bg: '#dcfce7', color: '#166534', label: 'יווצר' },
  skip:      { bg: '#fef3c7', color: '#92400e', label: 'ידולג' },
  duplicate: { bg: '#fee2e2', color: '#991b1b', label: 'כפול' },
  error:     { bg: '#fee2e2', color: '#991b1b', label: 'שגיאה' },
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.error
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      background: s.bg,
      color: s.color,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {s.label}
    </span>
  )
}

// Pure client-side classifier — must stay in sync with backend analyzeAgainst.
function classifyRows(rows, knownBoxTypes, existingIronsSet) {
  const seenInFile = new Map()
  const result = rows.map(r => {
    const iron = (r.iron_number || '').trim()
    if (!iron) return { ...r, iron_number: '', status: 'error', reason: 'מספר ברזל חסר' }
    if (existingIronsSet.has(iron)) {
      return { ...r, iron_number: iron, status: 'duplicate', reason: 'מספר ברזל כבר קיים במערכת' }
    }
    const bt = (r.box_type_name || '').trim()
    if (bt && !knownBoxTypes.has(bt)) {
      return { ...r, iron_number: iron, box_type_name: bt, status: 'skip', reason: `סוג קופה לא קיים: ${bt}` }
    }
    return { ...r, iron_number: iron, box_type_name: bt || null, status: 'ok', reason: '' }
  })
  for (const r of result) {
    if (r.status === 'error') continue
    if (seenInFile.has(r.iron_number)) {
      r.status = 'duplicate'
      r.reason = 'מספר ברזל מופיע יותר מפעם אחת בקובץ'
    } else {
      seenInFile.set(r.iron_number, r)
    }
  }
  return result
}

function summarize(rows) {
  return rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, { ok: 0, skip: 0, duplicate: 0, error: 0 })
}

// Compact inline editor — text or select depending on field.
function CellEditor({ value, onChange, options }) {
  if (options) {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '2px 4px', fontSize: 13 }}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', padding: '2px 4px', fontSize: 13 }}
    />
  )
}

export default function ImportBoxesPage() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)
  const [result, setResult] = useState(null)

  // Preview state — mutable across inline edits.
  const [rows, setRows] = useState(null)           // current rows (with live status)
  const [boxTypeNames, setBoxTypeNames] = useState([]) // string[]
  const [existingIrons, setExistingIrons] = useState(new Set())

  const boxTypeSet = useMemo(() => new Set(boxTypeNames), [boxTypeNames])

  // Filter: show only problematic rows so the user can focus on edits.
  const [onlyProblems, setOnlyProblems] = useState(false)

  function reset() {
    setFile(null)
    setRows(null)
    setBoxTypeNames([])
    setExistingIrons(new Set())
    setErrMsg(null)
    setResult(null)
  }

  function onPickFile(e) {
    const f = e.target.files?.[0] || null
    setFile(f)
    setRows(null)
    setErrMsg(null)
    setResult(null)
  }

  async function onPreview() {
    if (!file) return
    setLoading(true)
    setErrMsg(null)
    setResult(null)
    try {
      const data = await importsApi.previewBoxes(file)
      const types = (data.box_types || []).map(t => t.name)
      const irons = new Set(data.existing_irons || [])
      setBoxTypeNames(types)
      setExistingIrons(irons)
      // Re-run client-side classification so any local edits behave identically
      // to whatever the server says.
      setRows(classifyRows(data.rows, new Set(types), irons))
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בעיבוד הקובץ')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }

  // Edit one field of one row and re-classify the whole set (so within-file
  // duplicates update correctly).
  function editField(rowNum, key, value) {
    setRows(prev => {
      if (!prev) return prev
      const next = prev.map(r => r.rowNum === rowNum ? { ...r, [key]: value } : r)
      return classifyRows(next, boxTypeSet, existingIrons)
    })
  }

  async function onCommit() {
    if (!rows) return
    const okRows = rows.filter(r => r.status === 'ok')
    if (okRows.length === 0) return
    if (!confirm(`לבצע ייבוא של ${okRows.length} שורות?`)) return
    setCommitting(true)
    setErrMsg(null)
    try {
      const data = await importsApi.commitRows(okRows)
      setResult(data)
      setRows(null)
      setFile(null)
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בייבוא')
    } finally {
      setCommitting(false)
    }
  }

  const summary = useMemo(() => rows ? summarize(rows) : null, [rows])

  const canCommit = useMemo(() => {
    if (!summary) return false
    return (summary.ok || 0) > 0 &&
           (summary.duplicate || 0) === 0 &&
           (summary.error || 0) === 0 &&
           (summary.skip || 0) === 0
  }, [summary])

  const visibleRows = useMemo(() => {
    if (!rows) return []
    return onlyProblems ? rows.filter(r => r.status !== 'ok') : rows
  }, [rows, onlyProblems])

  const failedCount = useMemo(() => {
    if (!rows) return 0
    return rows.filter(r => r.status !== 'ok').length
  }, [rows])

  // Auto-toggle "only problems" on when there's something to fix and lots of rows.
  useEffect(() => {
    if (rows && rows.length > 50 && failedCount > 0) setOnlyProblems(true)
  }, [rows, failedCount])

  function downloadFailedCsv() {
    if (!rows) return
    const failed = rows.filter(r => r.status !== 'ok')
    if (failed.length === 0) return
    const headers = [
      'שורה באקסל', 'סטטוס', 'סיבה',
      'מספר ברזל', 'רחוב', 'מספר', 'שכונה', 'עיר',
      'סוג התקנה', 'סוג קופה', 'הערות מיקום',
    ]
    const statusLabel = { skip: 'ידולג', duplicate: 'כפול', error: 'שגיאה' }
    const esc = (v) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [headers.map(esc).join(',')]
    for (const r of failed) {
      lines.push([
        r.rowNum,
        statusLabel[r.status] || r.status,
        r.reason || '',
        r.iron_number || '',
        r.street || '',
        r.building || '',
        r.neighborhood || '',
        r.city || '',
        r.installation_type || '',
        r.box_type_name || '',
        r.location_notes || '',
      ].map(esc).join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import-failed-rows-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const blockReasons = useMemo(() => {
    if (!summary) return []
    const r = []
    if ((summary.duplicate || 0) > 0) r.push(`${summary.duplicate} מספרי ברזל כפולים — תקן בטבלה למטה`)
    if ((summary.error    || 0) > 0) r.push(`${summary.error} שורות שגויות (מספר ברזל חסר) — תקן בטבלה למטה`)
    if ((summary.skip     || 0) > 0) r.push(`${summary.skip} שורות עם סוג קופה לא ידוע — בחר סוג מהרשימה`)
    if ((summary.ok       || 0) === 0) r.push('אין שורות תקינות לייבוא')
    return r
  }, [summary])

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">ייבוא קופות מאקסל</div>
          <div className="page-subtitle">העלאת קובץ .xlsx — לכל שורה תיווצר קופה וכרטסת ראשונה</div>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onPickFile}
            disabled={loading || committing}
          />
          <button
            className="btn"
            onClick={onPreview}
            disabled={!file || loading || committing}
          >
            {loading ? 'טוען…' : 'נתח קובץ'}
          </button>
          {(file || rows || result) && (
            <button className="btn btn-secondary" onClick={reset} disabled={loading || committing}>
              נקה
            </button>
          )}
        </div>

        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text2)' }}>
          <b>עמודות צפויות (בעברית):</b> מספר ברזל, רחוב, מספר, שכונה, עיר, סוג התקנה, סוג קופה, הערות מיקום.
          <br />
          שורות עם בעיה (סוג קופה לא ידוע, מספר ברזל כפול/חסר) ניתנות לעריכה ישירות בטבלה למטה — אין צורך לשנות את האקסל.
        </div>
      </div>

      {errMsg && (
        <div className="panel" style={{ marginTop: 12, background: '#fee2e2', color: '#991b1b' }}>
          {errMsg}
        </div>
      )}

      {result && (
        <div className="panel" style={{ marginTop: 12, background: '#dcfce7', color: '#166534' }}>
          ✓ הייבוא הושלם: נוצרו {result.created} קופות וכרטסות.
        </div>
      )}

      {rows && summary && (
        <>
          <div className="panel" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>
                סה״כ שורות: <b>{rows.length}</b>
              </span>
              <span style={{ color: STATUS_STYLES.ok.color }}>
                יווצרו: <b>{summary.ok || 0}</b>
              </span>
              <span style={{ color: STATUS_STYLES.skip.color }}>
                ידולגו: <b>{summary.skip || 0}</b>
              </span>
              <span style={{ color: STATUS_STYLES.duplicate.color }}>
                כפולים: <b>{summary.duplicate || 0}</b>
              </span>
              <span style={{ color: STATUS_STYLES.error.color }}>
                שגויים: <b>{summary.error || 0}</b>
              </span>
            </div>

            {blockReasons.length > 0 && (
              <div style={{ marginTop: 10, color: '#991b1b', fontSize: 13 }}>
                {blockReasons.map((r, i) => <div key={i}>• {r}</div>)}
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={onCommit}
                disabled={!canCommit || committing}
              >
                {committing ? 'מייבא…' : `בצע ייבוא (${summary.ok || 0} שורות)`}
              </button>
              {failedCount > 0 && (
                <button
                  className="btn btn-secondary"
                  onClick={downloadFailedCsv}
                  disabled={committing}
                  title="הורד CSV עם כל השורות שלא ייובאו"
                >
                  הורד דוח ({failedCount})
                </button>
              )}
              <label style={{ marginInlineStart: 'auto', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(e) => setOnlyProblems(e.target.checked)}
                />
                הצג רק שורות עם בעיה
              </label>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 12, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>שורה</th>
                  <th>סטטוס</th>
                  <th>מספר ברזל</th>
                  <th>רחוב</th>
                  <th>מספר</th>
                  <th>שכונה</th>
                  <th>עיר</th>
                  <th>סוג התקנה</th>
                  <th>סוג קופה</th>
                  <th>הערות</th>
                  <th>סיבה</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const editable = r.status !== 'ok'
                  const cell = (key, options) => editable
                    ? <CellEditor value={r[key]} onChange={(v) => editField(r.rowNum, key, v)} options={options} />
                    : <span>{r[key] || '—'}</span>
                  return (
                    <tr key={r.rowNum}>
                      <td>{r.rowNum}</td>
                      <td><StatusPill status={r.status} /></td>
                      <td>{cell('iron_number')}</td>
                      <td>{cell('street')}</td>
                      <td>{cell('building')}</td>
                      <td>{cell('neighborhood')}</td>
                      <td>{cell('city')}</td>
                      <td>{cell('installation_type')}</td>
                      <td>{cell('box_type_name', boxTypeNames)}</td>
                      <td>{cell('location_notes')}</td>
                      <td style={{ color: r.status === 'ok' ? 'var(--text3)' : '#991b1b' }}>
                        {r.reason || ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
