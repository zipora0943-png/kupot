import React, { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { taskTypes as taskTypesApi } from '../api/endpoints'

/**
 * Edit / create a task type. Logic flags (opens_card / closes_card) drive the
 * card lifecycle when a task of this type is completed.
 *
 * Props:
 *   open        — boolean
 *   item        — present → edit; absent → create
 *   onClose     — () => void
 *   onSaved     — (saved) => void
 *   onDeleted   — (id) => void
 */
export default function TaskTypeModal({ open, item, onClose, onSaved, onDeleted }) {
  const isEdit = !!item

  const [name,        setName]        = useState('')
  const [icon,        setIcon]        = useState('')
  const [opensCard,   setOpensCard]   = useState(false)
  const [closesCard,  setClosesCard]  = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [errMsg,      setErrMsg]      = useState(null)

  useEffect(() => {
    if (!open) return
    setErrMsg(null); setSubmitting(false)
    if (isEdit) {
      setName(item.name || '')
      setIcon(item.icon || '')
      setOpensCard(!!item.opens_card)
      setClosesCard(!!item.closes_card)
    } else {
      setName(''); setIcon(''); setOpensCard(false); setClosesCard(false)
    }
  }, [open, isEdit, item])

  const lifecycleHint = useMemo(() => {
    if (opensCard && closesCard) return '🔄 בעת ביצוע: סגירת הכרטסת הקיימת + פתיחת חדשה (העברת מיקום)'
    if (opensCard)               return '📦 בעת ביצוע: פתיחת כרטסת חדשה (התקנה)'
    if (closesCard)              return '🗑️ בעת ביצוע: סגירת הכרטסת הפעילה (הסרה)'
    return 'ℹ️ בעת ביצוע: רק אירוע ביצוע יתווסף — ללא שינוי כרטסת'
  }, [opensCard, closesCard])

  async function handleSave() {
    setErrMsg(null)
    if (!name.trim()) return setErrMsg('יש להזין שם')
    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        icon: icon.trim() || null,
        opens_card: opensCard,
        closes_card: closesCard,
      }
      const saved = isEdit
        ? await taskTypesApi.update(item.id, body)
        : await taskTypesApi.create(body)
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
    if (!window.confirm(`למחוק את סוג המשימה "${item.name}"?`)) return
    setErrMsg(null)
    setSubmitting(true)
    try {
      await taskTypesApi.remove(item.id)
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
      title={isEdit ? 'עריכת סוג משימה' : 'סוג משימה חדש'}
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
          <label>שם סוג המשימה *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: התקנה" />
        </div>
        <div className="field">
          <label>אייקון</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="📦"
            style={{ width: 80, textAlign: 'center', fontSize: 20 }}
            maxLength={4}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', margin: '4px 0 8px' }}>
        לוגיקה בעת אישור ביצוע
      </div>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        padding: 10, background: 'var(--bg2, #f9fafb)', borderRadius: 8,
        border: '1px solid var(--border, #e5e7eb)', marginBottom: 8,
      }}>
        <input type="checkbox" checked={opensCard} onChange={(e) => setOpensCard(e.target.checked)} />
        <span style={{ fontSize: 14 }}>פתיחת כרטסת חדשה</span>
      </label>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        padding: 10, background: 'var(--bg2, #f9fafb)', borderRadius: 8,
        border: '1px solid var(--border, #e5e7eb)', marginBottom: 12,
      }}>
        <input type="checkbox" checked={closesCard} onChange={(e) => setClosesCard(e.target.checked)} />
        <span style={{ fontSize: 14 }}>סגירת הכרטסת הפעילה</span>
      </label>

      <div className="alert info" style={{ marginBottom: 12 }}>
        {lifecycleHint}
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}
    </Modal>
  )
}
