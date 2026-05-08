import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasks as tasksApi } from '../api/endpoints'
import TaskExecModal from '../components/TaskExecModal'
import TaskExecDetailsModal from '../components/TaskExecDetailsModal'
import { assetUrl } from '../utils/assetUrl'

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatDateTime(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABEL = {
  open: 'פתוחה',
  in_progress: 'בביצוע',
  done: 'בוצעה',
  cancelled: 'בוטלה',
}

export default function TaskViewPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [execOpen, setExecOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    tasksApi.get(taskId)
      .then((data) => { if (!cancelled) setTask(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'שגיאה בטעינת המשימה') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [taskId])

  const flavor = useMemo(() => {
    if (!task) return null
    const o = !!task.opens_card, c = !!task.closes_card
    if (o && c) return 'transfer'
    if (o)      return 'installation'
    if (c)      return 'removal'
    return 'generic'
  }, [task])

  const lifecycleHint = useMemo(() => {
    switch (flavor) {
      case 'transfer':     return 'סגירת הכרטסת הנוכחית + פתיחת כרטסת חדשה'
      case 'installation': return 'פתיחת כרטסת חדשה לקופה'
      case 'removal':      return 'סגירת הכרטסת (הקופה תישאר במלאי)'
      case 'generic':      return 'אירוע ביצוע יתווסף לכרטסת הפעילה (אם קיימת)'
      default: return ''
    }
  }, [flavor])

  const plannedLocation = useMemo(() => {
    if (!task) return ''
    const parts = [task.new_city, task.new_neighborhood, task.new_street, task.new_building]
      .map(s => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
    return parts.join(' • ')
  }, [task])

  function handleExecSuccess(updated) {
    if (updated) setTask(prev => ({ ...prev, ...updated }))
    setExecOpen(false)
    navigate('/tasks-alerts', { state: { tab: 'tasks' } })
  }

  if (loading) return <div className="loading">טוען...</div>
  if (error) return <div className="alert red">{error}</div>
  if (!task) return <div className="empty">לא נמצאה משימה</div>

  const isFinal = task.status === 'done' || task.status === 'cancelled'
  const title = `${task.icon || '📋'} ${task.type_name || 'משימה'}`
  const needsLocation = flavor === 'transfer' || flavor === 'installation'

  return (
    <div>
      <div className="collection-card">
        <h2>{title}</h2>
        <div className="sub">משימה #{task.id}</div>

        {lifecycleHint && (
          <div style={{
            background: 'var(--bg2, #f3f4f6)',
            borderRadius: 8,
            padding: '8px 10px',
            marginTop: 8,
            fontSize: 13,
            color: 'var(--text2)',
          }}>{lifecycleHint}</div>
        )}

        <div className="collection-info">
          <div className="kv">
            <span className="k">סטטוס</span>
            <span className="v">{STATUS_LABEL[task.status] || task.status}</span>
          </div>
          <div className="kv">
            <span className="k">קופה</span>
            <span className="v">{task.iron_number ? `#${task.iron_number}` : (task.box_id ? `#${task.box_id}` : '—')}</span>
          </div>
          <div className="kv">
            <span className="k">תאריך יצירה</span>
            <span className="v">{formatDate(task.created_at)}</span>
          </div>
          {task.due_date && (
            <div className="kv">
              <span className="k">תאריך יעד</span>
              <span className="v">{formatDate(task.due_date)}</span>
            </div>
          )}
          <div className="kv">
            <span className="k">משויכת ל</span>
            <span className="v">{task.assigned_name || '—'}</span>
          </div>
          {task.created_by_name && (
            <div className="kv">
              <span className="k">נוצרה ע"י</span>
              <span className="v">{task.created_by_name}</span>
            </div>
          )}
          {task.notes && (
            <div className="kv">
              <span className="k">הערות</span>
              <span className="v" style={{ whiteSpace: 'pre-wrap' }}>{task.notes}</span>
            </div>
          )}
          {needsLocation && plannedLocation && (
            <div className="kv">
              <span className="k">מיקום מתוכנן</span>
              <span className="v">{plannedLocation}</span>
            </div>
          )}
          {needsLocation && task.new_location_notes && (
            <div className="kv">
              <span className="k">הערות מיקום</span>
              <span className="v" style={{ whiteSpace: 'pre-wrap' }}>{task.new_location_notes}</span>
            </div>
          )}
          {isFinal && task.executed_at && (
            <div className="kv">
              <span className="k">{task.status === 'cancelled' ? 'בוטלה ב-' : 'בוצעה ב-'}</span>
              <span className="v">{formatDateTime(task.executed_at)}</span>
            </div>
          )}
        </div>

        {task.image_path && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>תמונת המשימה</label>
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
          </div>
        )}

        {isFinal && task.execution_notes && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>הערות ביצוע</label>
            <div style={{
              whiteSpace: 'pre-wrap',
              padding: 10,
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 8,
              background: 'var(--bg2, #f9fafb)',
            }}>{task.execution_notes}</div>
          </div>
        )}

        {isFinal && task.execution_image && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>תמונת אישור ביצוע</label>
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
          </div>
        )}

        {isFinal && task.status === 'cancelled' && task.cancellation_reason && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>סיבת ביטול</label>
            <div style={{
              whiteSpace: 'pre-wrap',
              padding: 10,
              border: '1px solid var(--red, #ef4444)',
              borderRadius: 8,
              background: 'var(--red-soft, #fef2f2)',
            }}>{task.cancellation_reason}</div>
          </div>
        )}

        <div className="collection-actions">
          {!isFinal && (
            <button
              type="button"
              className="btn-block"
              onClick={() => setExecOpen(true)}
            >✅ אישור ביצוע</button>
          )}
          {isFinal && (
            <button
              type="button"
              className="btn-block"
              onClick={() => setDetailsOpen(true)}
            >👁️ פרטי ביצוע מלאים</button>
          )}
          <button
            type="button"
            className="btn-block secondary"
            onClick={() => navigate('/tasks-alerts', { state: { tab: 'tasks' } })}
          >חזרה</button>
        </div>
      </div>

      <TaskExecModal
        open={execOpen}
        task={task}
        onClose={() => setExecOpen(false)}
        onSuccess={handleExecSuccess}
      />

      <TaskExecDetailsModal
        open={detailsOpen}
        task={task}
        onClose={() => setDetailsOpen(false)}
      />
    </div>
  )
}
