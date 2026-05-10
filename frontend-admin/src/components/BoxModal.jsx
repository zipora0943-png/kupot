import React, { useEffect, useState } from 'react'
import Modal from '@shared/components/Modal'
import { boxes as boxesApi, boxTypes as boxTypesApi } from '../api/endpoints'

/**
 * Create or edit a box.
 * Backend create endpoint: POST /api/boxes  (admin-only)
 * Backend update endpoint: PUT  /api/boxes/:id (admin-only, partial)
 *
 * Newly-created boxes default to status='uninstalled'. They become 'active'
 * only after a successful installation task is completed.
 *
 * Props:
 *   open    — boolean
 *   box     — present → edit; absent → create
 *   onClose — () => void
 *   onSaved — (savedBox) => void
 */
export default function BoxModal({ open, box, onClose, onSaved }) {
  const isEdit = !!box

  const [types, setTypes] = useState([])
  const [ironNumber, setIronNumber] = useState('')
  const [boxTypeId,  setBoxTypeId]  = useState('')
  const [notes,      setNotes]      = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    boxTypesApi.getAll()
      .then(d => !cancelled && setTypes(Array.isArray(d) ? d : []))
      .catch(() => !cancelled && setTypes([]))
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    setErrMsg(null)
    setSubmitting(false)
    if (isEdit) {
      setIronNumber(box.iron_number || '')
      setBoxTypeId(box.box_type_id != null ? String(box.box_type_id) : '')
      setNotes(box.notes || '')
    } else {
      setIronNumber('')
      setBoxTypeId('')
      setNotes('')
    }
  }, [open, isEdit, box])

  async function handleSave() {
    setErrMsg(null)
    if (!ironNumber.trim()) return setErrMsg('מספר ברזל הוא שדה חובה')

    const body = {
      iron_number: ironNumber.trim(),
      box_type_id: boxTypeId ? Number(boxTypeId) : null,
      notes: notes.trim() || null,
    }

    setSubmitting(true)
    try {
      const saved = isEdit
        ? await boxesApi.update(box.id, body)
        : await boxesApi.create(body)
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בשמירה')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={isEdit ? `עריכת קופה — ${box?.iron_number || ''}` : 'הוספת קופה'}
      footer={
        <>
          <div />
          <div className="actions">
            <button className="btn" type="button" onClick={onClose} disabled={submitting}>ביטול</button>
            <button className="btn primary" type="button" onClick={handleSave} disabled={submitting}>
              {submitting ? 'שומר...' : (isEdit ? 'שמירה' : 'הוספה')}
            </button>
          </div>
        </>
      }
    >
      <div className="modal-row">
        <div className="field">
          <label>מספר קופה (ברזל) *</label>
          <input
            value={ironNumber}
            onChange={(e) => setIronNumber(e.target.value)}
            placeholder="מספר ייחודי"
            autoFocus={!isEdit}
          />
        </div>
        <div className="field">
          <label>סוג קופה</label>
          <select value={boxTypeId} onChange={(e) => setBoxTypeId(e.target.value)}>
            <option value="">— ללא —</option>
            {types.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>הערות</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="אופציונלי"
        />
      </div>

      {!isEdit && (
        <div style={{
          fontSize: 13, color: 'var(--text2)', marginBottom: 14,
          padding: '10px 12px',
          background: 'var(--bg2, #f9fafb)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 8,
        }}>
          ℹ️ הקופה תתווסף לרשימת "לא מותקנות". פתיחת כרטסת תתבצע רק דרך אישור משימת התקנה.
        </div>
      )}

      {errMsg && <div className="alert red">{errMsg}</div>}
    </Modal>
  )
}
