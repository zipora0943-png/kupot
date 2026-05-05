import React, { useState } from 'react'
import { tasks as tasksApi } from '../api/endpoints'

export default function CancelTaskModal({ task, onClose, onCancelled }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!task) return null

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const res = await tasksApi.cancel(task.id, reason.trim() || null)
      onCancelled?.(res?.task)
      onClose?.()
    } catch (err) {
      setError(err.message || 'שגיאה בביטול המשימה')
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit()
  }

  const taskTitle = `${task.icon ? task.icon + ' ' : ''}${task.type_name || ''}` +
    (task.iron_number ? ` — קופה ${task.iron_number}` : '')

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>ביטול משימה</h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
            אתה עומד לבטל את המשימה: <strong>{taskTitle}</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            המשימה תועבר לסטטוס "בוטל" ולא תהיה ניתנת לביצוע. אם המשימה משויכת לכרטסת — יירשם אירוע "ביטול משימה".
          </p>
        </div>

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="field" style={{ marginBottom: 16 }}>
          <label>סיבת ביטול <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="למשל: שונה האזור, נמסרה משימה כפולה, התקבלה החלטה אחרת..."
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
            {loading ? 'מבטל...' : '🚫 בטל משימה'}
          </button>
        </div>
      </div>
    </div>
  )
}
