import React, { useState } from 'react'

export default function ReopenCardModal({ cardLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      await onConfirm(reason.trim() || null)
    } catch (err) {
      setError(err.message || 'שגיאה בפתיחה מחדש של הכרטסת')
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>פתיחה מחדש של כרטסת</h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
            אתה עומד לפתוח מחדש את הכרטסת: <strong>{cardLabel}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            הסטטוס יחזור ל-"פעיל" וייווצר אירוע "פתיחה מחדש". אם הקופה הייתה לא מותקנת/לא פעילה — היא תחזור לפעילה.
          </p>
        </div>

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="field" style={{ marginBottom: 16 }}>
          <label>סיבת פתיחה מחדש <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="למשל: הכרטסת נסגרה בטעות, החזרת קופה למיקום, וכו'"
            disabled={loading}
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>ביטול</button>
          <button
            className="btn success"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'פותח...' : '🔓 פתח מחדש'}
          </button>
        </div>
      </div>
    </div>
  )
}
