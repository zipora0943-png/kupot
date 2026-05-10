import React, { useState } from 'react'
import { reports as reportsApi } from '@app-api/endpoints'

export default function CloseReportModal({ report, onClose, onClosed }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!report) return null

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const updated = await reportsApi.close(report.id, reason.trim() || null)
      onClosed?.(updated)
      onClose?.()
    } catch (err) {
      setError(err.message || 'שגיאה בסגירת הדיווח')
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit()
  }

  const reportTitle = `${report.icon ? report.icon + ' ' : ''}${report.type_name || 'דיווח'}` +
    (report.iron_number ? ` — קופה ${report.iron_number}` : '')

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>סגירת דיווח</h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
            אתה עומד לסגור את הדיווח: <strong>{reportTitle}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            הדיווח יועבר לסטטוס "סגור" ללא יצירת משימה. אם הדיווח מקושר לכרטסת — יירשם אירוע "סגירת דיווח".
          </p>
        </div>

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="field" style={{ marginBottom: 16 }}>
          <label>סיבת סגירה <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="למשל: טופל ידנית, לא רלוונטי, שגיאה בדיווח..."
            disabled={loading}
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>חזור</button>
          <button
            className="btn danger"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'סוגר...' : '🚫 סגור דיווח'}
          </button>
        </div>
      </div>
    </div>
  )
}
