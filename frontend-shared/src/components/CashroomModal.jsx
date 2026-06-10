import React, { useEffect, useState } from 'react'
import Modal from '@shared/components/Modal'
// `@app-api` resolves to the importing frontend's own src/api, so this shared
// modal uses each app's local endpoints (both expose the same envelope routes).
import { envelopes as envelopesApi } from '@app-api/endpoints'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—'
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return '₪' + num.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// Full address: city, neighborhood, street + house number.
function formatAddress(env) {
  if (!env) return ''
  const streetLine = env.street
    ? `${env.street}${env.building ? ' ' + env.building : ''}`
    : null
  return [env.city, env.neighborhood, streetLine].filter(Boolean).join(', ')
}

/**
 * Cashroom modal — two modes:
 *   1) `pending` envelope → cashroom enters amount for the first time.
 *      Backend: PUT /api/envelopes/:id with { amount, notes }.
 *   2) `entered` envelope → details view + admin/cashroom can edit the amount.
 *      Backend: PATCH /api/envelopes/:id/amount with { amount, reason }.
 *      A reason is optional; an `amount_changed` event is created automatically.
 *
 * Props:
 *   open      — boolean
 *   envelope  — the row to enter/edit; must include id, envelope_number, iron_number,
 *               city, collected_at, collector_name, status, amount.
 *   onClose   — () => void
 *   onSaved   — (updatedEnvelope) => void
 */
export default function CashroomModal({ open, envelope, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [notes,  setNotes]  = useState('')
  const [reason, setReason] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    if (!open || !envelope) return
    setAmount(envelope.amount != null ? String(envelope.amount) : '')
    setNotes(envelope.notes || '')
    setReason('')
    setEditMode(false)
    setErrMsg(null)
    setSubmitting(false)
  }, [open, envelope])

  const isPending = envelope?.status === 'pending'
  const isEntered = envelope?.status === 'entered'
  // In edit-mode, the amount field is editable. Always editable for pending.
  const amountEditable = isPending || (isEntered && editMode)
  const originalAmount = envelope?.amount != null ? Number(envelope.amount) : null

  async function handleSubmit() {
    if (!envelope) return
    setErrMsg(null)
    const n = Number(amount)
    if (!Number.isFinite(n) || n < 0) {
      setErrMsg('יש להזין סכום תקין (מספר אי-שלילי)')
      return
    }
    if (n > 99999.99) {
      setErrMsg('הסכום חורג מהמקסימום (99,999.99)')
      return
    }

    setSubmitting(true)
    try {
      let saved
      if (isPending) {
        saved = await envelopesApi.update(envelope.id, {
          amount: n,
          notes: notes.trim() || null,
        })
      } else {
        // edit-after-entered flow
        if (originalAmount != null && Number(originalAmount.toFixed(2)) === Number(n.toFixed(2))) {
          setErrMsg('הסכום החדש זהה לסכום הקיים')
          setSubmitting(false)
          return
        }
        saved = await envelopesApi.updateAmount(envelope.id, n, reason.trim() || null)
      }
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בשמירה')
    } finally {
      setSubmitting(false)
    }
  }

  const title = isPending
    ? 'הזנת סכום למעטפה'
    : (editMode ? 'עריכת סכום מעטפה' : 'פרטי מעטפה')

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={title}
      footer={
        <>
          <div />
          <div className="actions">
            <button
              className="btn"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >{(isPending || editMode) ? 'ביטול' : 'סגור'}</button>

            {isEntered && !editMode && (
              <button
                className="btn primary"
                type="button"
                onClick={() => { setEditMode(true); setErrMsg(null) }}
              >✏️ ערוך סכום</button>
            )}

            {(isPending || (isEntered && editMode)) && (
              <button
                className="btn success"
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? 'מבצע...'
                  : (isPending ? '✅ אישור הזנה' : '💾 שמור שינוי')}
              </button>
            )}
          </div>
        </>
      }
    >
      {!envelope ? null : (
        <>
          {/* Envelope context — read-only header */}
          <div style={{
            background: 'var(--bg2, #f9fafb)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
            fontSize: 13,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                מעטפה #{envelope.envelope_number}
              </div>
              {!isPending && (
                <span className="pill green">הוזן</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, color: 'var(--text2)' }}>
              <div>קופה: <strong style={{ color: 'var(--text)' }}>{envelope.iron_number || '—'}</strong></div>
              <div>תאריך גביה: <strong style={{ color: 'var(--text)' }}>{formatDate(envelope.collected_at)}</strong></div>
              {envelope.collector_name && <div>גובה: <strong style={{ color: 'var(--text)' }}>{envelope.collector_name}</strong></div>}
              {formatAddress(envelope) && (
                <div style={{ gridColumn: '1 / -1' }}>כתובת: <strong style={{ color: 'var(--text)' }}>{formatAddress(envelope)}</strong></div>
              )}
            </div>
          </div>

          {isEntered && !editMode && (
            <div className="alert info" style={{ marginBottom: 12 }}>
              ℹ️ מעטפה זו כבר הוזנה. ניתן לערוך את הסכום בלחיצה על "ערוך סכום" — שינוי כזה ייווצר בכרטסת אירוע "שינוי סכום" עם הסכום הישן והחדש.
            </div>
          )}

          {isEntered && editMode && originalAmount != null && (
            <div className="alert info" style={{ marginBottom: 12 }}>
              ℹ️ הסכום הנוכחי: <strong>{formatMoney(originalAmount)}</strong>. שינוי הסכום יתועד בכרטסת כאירוע "שינוי סכום".
            </div>
          )}

          <div className="field" style={{ marginBottom: 14 }}>
            <label>סכום (₪)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="99999.99"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!amountEditable || submitting}
              style={{
                fontSize: 28,
                textAlign: 'center',
                padding: 14,
                fontWeight: 700,
              }}
              autoFocus={amountEditable}
            />
          </div>

          {isPending && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>הערות</label>
              <input
                placeholder="הערות (אופציונלי)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          {isEntered && !editMode && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>הערות</label>
              <input value={notes} disabled />
            </div>
          )}

          {isEntered && editMode && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>סיבת השינוי <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
              <input
                placeholder="מה גרם לשינוי הסכום?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          {errMsg && <div className="alert red">{errMsg}</div>}
        </>
      )}
    </Modal>
  )
}
