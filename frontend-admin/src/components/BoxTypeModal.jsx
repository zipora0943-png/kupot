import React, { useEffect, useState } from 'react'
import Modal from '@shared/components/Modal'
import { boxTypes as boxTypesApi } from '../api/endpoints'

/**
 * Edit / create a box type — name only.
 *
 * Props:
 *   open      — boolean
 *   item      — present → edit; absent → create
 *   onClose   — () => void
 *   onSaved   — (saved) => void
 *   onDeleted — (id) => void
 */
export default function BoxTypeModal({ open, item, onClose, onSaved, onDeleted }) {
  const isEdit = !!item

  const [name, setName] = useState('')
  const [kind, setKind] = useState('street')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    setErrMsg(null); setSubmitting(false)
    setName(isEdit ? (item.name || '') : '')
    setKind(isEdit ? (item.kind || 'street') : 'street')
  }, [open, isEdit, item])

  async function handleSave() {
    setErrMsg(null)
    if (!name.trim()) return setErrMsg('יש להזין שם')
    setSubmitting(true)
    try {
      const body = { name: name.trim(), kind }
      const saved = isEdit
        ? await boxTypesApi.update(item.id, body)
        : await boxTypesApi.create(body)
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בשמירה')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    if (!window.confirm(`למחוק את סוג הקופה "${item.name}"?`)) return
    setErrMsg(null)
    setSubmitting(true)
    try {
      await boxTypesApi.remove(item.id)
      onDeleted?.(item.id)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה במחיקה')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={isEdit ? 'עריכת סוג קופה' : 'סוג קופה חדש'}
      footer={
        <>
          {isEdit ? (
            <button
              className="btn sm"
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              style={{ color: 'var(--red)' }}
            >מחיקה</button>
          ) : <div />}
          <div className="actions">
            <button className="btn" type="button" onClick={onClose} disabled={submitting}>ביטול</button>
            <button className="btn primary" type="button" onClick={handleSave} disabled={submitting}>
              {submitting ? 'שומר...' : 'שמירה'}
            </button>
          </div>
        </>
      }
    >
      <div className="field" style={{ marginBottom: 12 }}>
        <label>שם סוג הקופה *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: גדולה" autoFocus />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>קטגוריה</label>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="street">קופת רחוב</option>
          <option value="shop">קופת חנות</option>
          <option value="other">אחר</option>
        </select>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          הקיצור "כל קופות הרחוב" בסינון הכרטסות בוחר את כל הסוגים שאינם "חנות".
        </div>
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}
    </Modal>
  )
}
