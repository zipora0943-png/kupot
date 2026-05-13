import React from 'react'
import Modal from '@shared/components/Modal'
import { assetUrl } from '../utils/assetUrl'

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Read-only display of a completed task's execution details.
 *
 * Props:
 *   open    — boolean
 *   task    — completed task row (status='done' / 'cancelled' / 'not_executed');
 *             reads execution_notes, execution_image, executed_at, type_name, icon, iron_number
 *   onClose — () => void
 */
export default function TaskExecDetailsModal({ open, task, onClose }) {
  const isCancelled   = task?.status === 'cancelled'
  const isNotExecuted = task?.status === 'not_executed'
  const title = isCancelled   ? 'פרטי ביטול'
              : isNotExecuted ? 'פרטי אי-ביצוע'
                              : 'פרטי ביצוע'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {task ? <>קופה <strong>{task.iron_number || task.box_id}</strong></> : null}
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={onClose}>סגירה</button>
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
              {task.icon ? `${task.icon} ` : ''}{task.type_name || '—'}
            </div>
            <div style={{ color: 'var(--text2)' }}>
              {isCancelled   ? 'בוטלה ב-'
               : isNotExecuted ? 'דווחה כלא בוצעה ב-'
                               : 'בוצע ב-'}
              {formatDateTime(task.executed_at)}
              {task.assigned_name ? <> · ע"י <strong style={{ color: 'var(--text)' }}>{task.assigned_name}</strong></> : null}
            </div>
          </div>

          {isCancelled && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>סיבת ביטול</label>
              {task.cancellation_reason
                ? <div style={{
                    whiteSpace: 'pre-wrap',
                    padding: 10,
                    border: '1px solid var(--red, #ef4444)',
                    borderRadius: 8,
                    background: 'var(--red-soft, #fef2f2)',
                    minHeight: 60,
                  }}>{task.cancellation_reason}</div>
                : <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>לא צוינה סיבה</div>}
            </div>
          )}

          {isNotExecuted && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>סיבת אי-ביצוע</label>
              {task.not_executed_reason
                ? <div style={{
                    whiteSpace: 'pre-wrap',
                    padding: 10,
                    border: '1px solid var(--red, #ef4444)',
                    borderRadius: 8,
                    background: 'var(--red-soft, #fef2f2)',
                    minHeight: 60,
                  }}>{task.not_executed_reason}</div>
                : <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>לא צוינה סיבה</div>}
            </div>
          )}

          <div className="field" style={{ marginBottom: 12 }}>
            <label>הערות ביצוע</label>
            {task.execution_notes
              ? <div style={{
                  whiteSpace: 'pre-wrap',
                  padding: 10,
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: 8,
                  background: 'var(--bg2, #f9fafb)',
                  minHeight: 60,
                }}>{task.execution_notes}</div>
              : <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>לא נרשמו הערות</div>}
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>תמונת המשימה</label>
            {task.image_path
              ? (
                <a href={assetUrl(task.image_path)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={assetUrl(task.image_path)}
                    alt="תמונת המשימה"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 8,
                      border: '1px solid var(--border, #e5e7eb)',
                      display: 'block',
                    }}
                  />
                </a>
              )
              : <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>לא צורפה תמונה למשימה</div>}
          </div>

          <div className="field">
            <label>{isCancelled ? 'תמונת ביצוע' : 'תמונת אישור ביצוע'}</label>
            {task.execution_image
              ? (
                <a href={assetUrl(task.execution_image)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={assetUrl(task.execution_image)}
                    alt="תמונת ביצוע"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 8,
                      border: '1px solid var(--border, #e5e7eb)',
                      display: 'block',
                    }}
                  />
                </a>
              )
              : <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>לא צורפה תמונה בעת אישור הביצוע</div>}
          </div>
        </>
      )}
    </Modal>
  )
}
