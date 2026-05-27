import React, { useState } from 'react'

// Task 51: swap the underlying box of an active card. The card itself
// (envelopes, events, full history) stays put — only `cards.box_id` is
// reassigned to a different box. The OLD box is always marked 'unusable'
// (per product decision), the NEW box becomes 'active'.
export default function SwapBoxModal({ cardLabel, currentIron, onClose, onConfirm }) {
  const [ironNumber, setIronNumber] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    const iron = ironNumber.trim()
    if (!iron) {
      setError('יש להזין מספר ברזל של הקופה החדשה')
      return
    }
    if (iron === currentIron) {
      setError('מספר הברזל זהה לקופה הנוכחית')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onConfirm({ iron_number: iron, reason: reason.trim() })
    } catch (err) {
      setError(err.message || 'שגיאה בהחלפת הקופה')
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
          <h3>החלפת מספר קופה</h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
            החלפת הקופה לכרטסת: <strong>{cardLabel}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>
            הכרטסת תישאר עם כל ההיסטוריה (מעטפות, אירועים, גביות) — רק מספר הקופה הפיזית יוחלף.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            הקופה הישנה (<strong>{currentIron || '—'}</strong>) תסומן כ"לא שמישה". הקופה החדשה חייבת להיות קיימת במערכת וללא כרטסת פעילה.
          </p>
        </div>

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="field" style={{ marginBottom: 12 }}>
          <label>מספר ברזל של הקופה החדשה *</label>
          <input
            value={ironNumber}
            onChange={(e) => setIronNumber(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="לדוגמה: 100482"
            disabled={loading}
            autoFocus
          />
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label>סיבת ההחלפה <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="למשל: קופה התקלקלה, החלפה לקופה חדשה..."
            disabled={loading}
            style={{ minHeight: 80 }}
          />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>ביטול</button>
          <button
            className="btn success"
            onClick={handleSubmit}
            disabled={loading || !ironNumber.trim()}
          >
            {loading ? 'מחליף...' : '🔁 החלף קופה'}
          </button>
        </div>
      </div>
    </div>
  )
}
