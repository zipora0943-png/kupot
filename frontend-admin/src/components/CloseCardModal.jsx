import React, { useState } from 'react'

export default function CloseCardModal({ cardId, cardLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    if (!reason.trim()) {
      setError('יש להזין סיבת סגירה')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      setError(err.message || 'שגיאה בסגירת כרטסה')
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
          <h3>סגירת כרטסה</h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
            אתה עומד לסגור את הכרטסה: <strong>{cardLabel}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            לאחר הסגירה, לא יהיה אפשר להוסיף מעטפות או משימות לכרטסה זו.
          </p>
        </div>

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="field" style={{ marginBottom: 16 }}>
          <label>סיבת סגירה *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="למשל: קופה הוסרה מהמיקום, העברה לקופה חדשה, וכו'"
            disabled={loading}
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>ביטול</button>
          <button
            className="btn danger"
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
          >
            {loading ? 'סוגר...' : '🚪 סגור כרטסה'}
          </button>
        </div>
      </div>
    </div>
  )
}
