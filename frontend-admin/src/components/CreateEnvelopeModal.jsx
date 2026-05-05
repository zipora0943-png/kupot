import React, { useState } from 'react'

export default function CreateEnvelopeModal({ onClose, onConfirm }) {
  const [envelopeNumber, setEnvelopeNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    if (!envelopeNumber.trim()) {
      setError('יש להזין מספר מעטפה')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onConfirm(envelopeNumber.trim(), notes.trim() || null)
    } catch (err) {
      setError(err.message || 'שגיאה ביצירת מעטפה')
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
          <h3>מעטפה חדשה</h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="field" style={{ marginBottom: 12 }}>
          <label>מספר מעטפה *</label>
          <input
            value={envelopeNumber}
            onChange={(e) => setEnvelopeNumber(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="למשל: ENV-001"
            disabled={loading}
            autoFocus
          />
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label>הערות (אופציונלי)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="הערות כלליות על המעטפה..."
            disabled={loading}
            style={{ minHeight: 80 }}
          />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>ביטול</button>
          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={loading || !envelopeNumber.trim()}
          >
            {loading ? 'יוצר...' : '➕ יצור מעטפה'}
          </button>
        </div>
      </div>
    </div>
  )
}
