import React, { useEffect, useMemo } from 'react'
import { computeCardLabels } from '../utils/cardLabel'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function locationText(c) {
  const parts = []
  if (c.city) parts.push(c.city)
  if (c.street) parts.push(c.street + (c.building ? ' ' + c.building : ''))
  return parts.join(' · ') || '—'
}

/**
 * Modal that asks the user which card (כרטסת) of a given box to use,
 * when the box has more than one card in its history.
 *
 * Props:
 *   ironNumber — string, displayed in the title
 *   cards      — array of card objects ({ id, box_id, iron_number, status, opened_at, closed_at, city, street, building, ... })
 *   onSelect   — called with the chosen card object
 *   onClose    — called on Cancel / Escape / backdrop click
 */
export default function CardChoiceModal({ ironNumber, cards, onSelect, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Sort newest-first for display, but compute labels using the canonical
  // (oldest-first) order so suffixes (A/B/C…) match the rest of the system.
  const labels = useMemo(() => computeCardLabels(cards), [cards])
  const sorted = useMemo(() => {
    const arr = [...(cards || [])]
    arr.sort((a, b) => {
      const da = a.opened_at ? new Date(a.opened_at).getTime() : 0
      const db = b.opened_at ? new Date(b.opened_at).getTime() : 0
      return db - da
    })
    return arr
  }, [cards])

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="modal-box">
        <div className="modal-header">
          <h3>בחירת כרטסת — קופה {ironNumber}</h3>
          <button className="modal-close" type="button" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 12 }}>
          לקופה זו יש <strong>{cards.length}</strong> כרטסות. בחר את הכרטסת שעליה יופק הדוח:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
          {sorted.map(c => {
            const label = labels.get(c.id) || `${c.iron_number || ironNumber}`
            const isActive = c.status === 'active'
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  padding: '10px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'right',
                  width: '100%',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-soft)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--accent)' }}>{label}</strong>
                  {isActive
                    ? <span className="pill green">פעילה</span>
                    : <span className="pill" style={{ background: 'var(--surface)', color: 'var(--text3)' }}>סגורה</span>}
                </div>
                <div style={{ fontSize: 13 }}>{locationText(c)}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {c.opened_at && <>נפתחה: {fmtDate(c.opened_at)}</>}
                  {c.closed_at && <> · נסגרה: {fmtDate(c.closed_at)}</>}
                </div>
              </button>
            )
          })}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
