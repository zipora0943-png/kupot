import React, { useState } from 'react'

export default function CreateEnvelopeModal({ onClose, onConfirm }) {
  const [envelopeNumber, setEnvelopeNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    // Envelope numbers are always exactly 6 digits (matches the collector
    // scanner and the backend validation).
    if (!/^\d{6}$/.test(envelopeNumber.trim())) {
      setError('מספר מעטפה חייב להיות בדיוק 6 ספרות')
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
            onChange={(e) => setEnvelopeNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={handleKeyDown}
            inputMode="numeric"
            maxLength={6}
            placeholder="6 ספרות, למשל: 123456"
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
            disabled={loading || !/^\d{6}$/.test(envelopeNumber)}
          >
            {loading ? 'יוצר...' : '➕ יצור מעטפה'}
          </button>
        </div>
      </div>
    </div>
  )
}
