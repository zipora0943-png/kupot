import React, { useEffect, useState } from 'react'
import Modal from './Modal'
import { reportTypes as reportTypesApi } from '../api/endpoints'

/**
 * Edit / create a report type. Simpler than task types — no lifecycle flags.
 *
 * Props:
 *   open      — boolean
 *   item      — present → edit; absent → create
 *   onClose   — () => void
 *   onSaved   — (saved) => void
 *   onDeleted — (id) => void
 */
export default function ReportTypeModal({ open, item, onClose, onSaved, onDeleted }) {
  const isEdit = !!item

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    setErrMsg(null); setSubmitting(false)
    if (isEdit) {
      setName(item.name || '')
      setIcon(item.icon || '')
    } else {
      setName(''); setIcon('')
    }
  }, [open, isEdit, item])

  async function handleSave() {
    setErrMsg(null)
    if (!name.trim()) return setErrMsg('יש להזין שם')
    setSubmitting(true)
    try {
      const body = { name: name.trim(), icon: icon.trim() || null }
      const saved = isEdit
        ? await reportTypesApi.update(item.id, body)
        : await reportTypesApi.create(body)
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
    if (!window.confirm(`למחוק את סוג הדיווח "${item.name}"?`)) return
    setErrMsg(null)
    setSubmitting(true)
    try {
      await reportTypesApi.remove(item.id)
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
      title={isEdit ? 'עריכת סוג דיווח' : 'סוג דיווח חדש'}
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
      <div className="modal-row">
        <div className="field grow">
          <label>שם סוג הדיווח *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: מנעול" />
        </div>
        <div className="field">
          <label>אייקון</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🔒"
            style={{ width: 80, textAlign: 'center', fontSize: 20 }}
            maxLength={4}
          />
        </div>
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}
    </Modal>
  )
}
