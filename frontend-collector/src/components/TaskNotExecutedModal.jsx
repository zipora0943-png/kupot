import React, { useEffect, useState } from 'react'
import Modal from '@shared/components/Modal'
import { tasks as tasksApi } from '../api/endpoints'

/**
 * Collector modal: report that the task could not be executed.
 * Requires a free-text reason; closes the task with status='not_executed'.
 * Does NOT trigger card lifecycle (even for opens_card/closes_card task types).
 */
export default function TaskNotExecutedModal({ open, task, onClose, onSuccess }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    setReason('')
    setErrMsg(null)
    setSubmitting(false)
  }, [open])

  async function handleSubmit() {
    if (!task) return
    const trimmed = reason.trim()
    if (!trimmed) {
      setErrMsg('יש להזין סיבה לאי-ביצוע')
      return
    }
    setSubmitting(true)
    setErrMsg(null)
    try {
      const res = await tasksApi.reportNotExecuted(task.id, trimmed)
      onSuccess?.(res?.task || null)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בדיווח אי-ביצוע')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="דיווח: לא בוצעה"
      footer={
        <>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {task ? <>קופה <strong>{task.iron_number || task.box_id}</strong></> : null}
          </div>
          <div className="actions">
            <button
              className="btn"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >ביטול</button>
            <button
              className="btn danger"
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'שולח...' : 'אישור'}
            </button>
          </div>
        </>
      }
    >
      {!task ? null : (
        <>
          <div style={{
            background: 'var(--bg2, #f3f4f6)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 14,
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {task.icon ? `${task.icon} ` : ''}{task.type_name}
            </div>
            <div style={{ color: 'var(--text2)' }}>
              המשימה תיסגר ללא ביצוע ולא ניתן יהיה לבצעה. אם קיימת כרטסת — יירשם אירוע "לא בוצעה" בכרטסת.
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>סיבת אי-ביצוע *</label>
            <textarea
              rows={4}
              placeholder="למשל: הקופה הוסרה ע״י בעל המקום, הכתובת שגויה, לא נמצא מי שיפתח..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          {errMsg && <div className="alert red">{errMsg}</div>}
        </>
      )}
    </Modal>
  )
}
