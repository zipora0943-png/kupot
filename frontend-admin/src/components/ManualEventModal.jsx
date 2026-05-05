import React, { useState } from 'react'
import { events as eventsApi } from '../api/endpoints'

const EVENT_OPTIONS = [
  { value: 'other',          label: 'אחר (ברירת מחדל)' },
  { value: 'collection',     label: 'גביה' },
  { value: 'task_done',      label: 'ביצוע משימה' },
  { value: 'installation',   label: 'התקנה' },
  { value: 'removal',        label: 'הסרה' },
  { value: 'card_closed',    label: 'סגירת כרטסת' },
  { value: 'transfer_open',  label: 'העברה (פתיחה)' },
  { value: 'transfer_close', label: 'העברה (סגירה)' },
  { value: 'mark_unusable',  label: 'סומנה כלא שמישה' },
  { value: 'reopen',         label: 'פתיחה מחדש' },
]

export default function ManualEventModal({ cardId, cardLabel, onClose, onCreated }) {
  const [eventType, setEventType] = useState('other')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isOther = eventType === 'other'
  const trimmed = description.trim()
  const canSubmit = !loading && (!isOther || trimmed.length > 0)

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    try {
      const created = await eventsApi.create({
        card_id: cardId,
        event_type: eventType,
        description: trimmed || null,
      })
      onCreated?.(created)
      onClose?.()
    } catch (err) {
      setError(err.message || 'שגיאה ביצירת האירוע')
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
          <h3>יצירת אירוע ידני</h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
          אירוע ידני יתועד בכרטסת <strong>{cardLabel}</strong> ויירשם על שמך.
        </p>

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="field" style={{ marginBottom: 12 }}>
          <label>סוג אירוע</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            disabled={loading}
          >
            {EVENT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label>
            תיאור{' '}
            {isOther
              ? <span style={{ color: 'var(--danger)', fontWeight: 400 }}>(חובה לסוג "אחר")</span>
              : <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span>}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="פרטים על האירוע..."
            disabled={loading}
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>ביטול</button>
          <button
            className="btn success"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? 'יוצר...' : '➕ צור אירוע'}
          </button>
        </div>
      </div>
    </div>
  )
}
