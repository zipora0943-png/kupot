import React, { useMemo, useState } from 'react'
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

export default function ImportBoxesPage() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null) // { rows, summary }
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)
  const [result, setResult] = useState(null) // { created, skipped, rows }

  function reset() {
    setFile(null)
    setPreview(null)
    setErrMsg(null)
    setResult(null)
  }

  function onPickFile(e) {
    const f = e.target.files?.[0] || null
    setFile(f)
    setPreview(null)
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
      setPreview(data)
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בעיבוד הקובץ')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  async function onCommit() {
    if (!file) return
    if (!confirm(`לבצע ייבוא של ${preview?.summary?.ok || 0} שורות?`)) return
    setCommitting(true)
    setErrMsg(null)
    try {
      const data = await importsApi.commitBoxes(file)
      setResult(data)
      setPreview(null)
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בייבוא')
    } finally {
      setCommitting(false)
    }
  }

  const canCommit = useMemo(() => {
    if (!preview) return false
    const s = preview.summary || {}
    return (s.ok || 0) > 0 && (s.duplicate || 0) === 0 && (s.error || 0) === 0
  }, [preview])

  const failedRows = useMemo(() => {
    if (!preview) return []
    return preview.rows.filter(r => r.status !== 'ok')
  }, [preview])

  // CSV with UTF-8 BOM so Excel opens Hebrew correctly.
  function downloadFailedCsv() {
    if (failedRows.length === 0) return
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
    for (const r of failedRows) {
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
    if (!preview) return []
    const s = preview.summary || {}
    const r = []
    if ((s.duplicate || 0) > 0) r.push(`${s.duplicate} מספרי ברזל כפולים — תקן באקסל לפני המשך`)
    if ((s.error    || 0) > 0) r.push(`${s.error} שורות שגויות (מספר ברזל חסר) — תקן באקסל לפני המשך`)
    if ((s.ok       || 0) === 0) r.push('אין שורות תקינות לייבוא')
    return r
  }, [preview])

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
          {(file || preview || result) && (
            <button className="btn btn-secondary" onClick={reset} disabled={loading || committing}>
              נקה
            </button>
          )}
        </div>

        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text2)' }}>
          <b>עמודות צפויות (בעברית):</b> מספר ברזל, רחוב, מספר, שכונה, עיר, סוג התקנה, סוג קופה, הערות מיקום.
          <br />
          סוג קופה צריך להתאים לשם קיים בטבלת סוגי הקופות — שורות עם סוג לא ידוע יידולגו.
          ערים חדשות יתווספו אוטומטית (ללא מחוז). מספר ברזל שכבר קיים — יבטל את כל הייבוא.
        </div>
      </div>

      {errMsg && (
        <div className="panel" style={{ marginTop: 12, background: '#fee2e2', color: '#991b1b' }}>
          {errMsg}
        </div>
      )}

      {result && (
        <div className="panel" style={{ marginTop: 12, background: '#dcfce7', color: '#166534' }}>
          ✓ הייבוא הושלם: נוצרו {result.created} קופות וכרטסות. דולגו {result.skipped} שורות.
        </div>
      )}

      {preview && (
        <>
          <div className="panel" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>
                סה״כ שורות: <b>{preview.rows.length}</b>
              </span>
              <span style={{ color: STATUS_STYLES.ok.color }}>
                יווצרו: <b>{preview.summary.ok || 0}</b>
              </span>
              <span style={{ color: STATUS_STYLES.skip.color }}>
                ידולגו: <b>{preview.summary.skip || 0}</b>
              </span>
              <span style={{ color: STATUS_STYLES.duplicate.color }}>
                כפולים: <b>{preview.summary.duplicate || 0}</b>
              </span>
              <span style={{ color: STATUS_STYLES.error.color }}>
                שגויים: <b>{preview.summary.error || 0}</b>
              </span>
            </div>

            {blockReasons.length > 0 && (
              <div style={{ marginTop: 10, color: '#991b1b', fontSize: 13 }}>
                {blockReasons.map((r, i) => <div key={i}>• {r}</div>)}
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={onCommit}
                disabled={!canCommit || committing}
              >
                {committing ? 'מייבא…' : `בצע ייבוא (${preview.summary.ok || 0} שורות)`}
              </button>
              {failedRows.length > 0 && (
                <button
                  className="btn btn-secondary"
                  onClick={downloadFailedCsv}
                  disabled={committing}
                  title="הורד CSV עם כל השורות שלא ייובאו (דולגות / כפולות / שגויות)"
                >
                  הורד דוח שורות לא מיובאות ({failedRows.length})
                </button>
              )}
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
                {preview.rows.map((r) => (
                  <tr key={r.rowNum}>
                    <td>{r.rowNum}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.iron_number || '—'}</td>
                    <td>{r.street || '—'}</td>
                    <td>{r.building || '—'}</td>
                    <td>{r.neighborhood || '—'}</td>
                    <td>{r.city || '—'}</td>
                    <td>{r.installation_type || '—'}</td>
                    <td>{r.box_type_name || '—'}</td>
                    <td>{r.location_notes || '—'}</td>
                    <td style={{ color: r.status === 'ok' ? 'var(--text3)' : '#991b1b' }}>
                      {r.reason || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
