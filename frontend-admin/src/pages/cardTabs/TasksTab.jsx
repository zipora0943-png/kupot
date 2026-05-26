import React, { useEffect, useState } from 'react'
import { tasks as tasksApi } from '../../api/endpoints'
import TaskModal from '../../components/TaskModal'
import TaskExecDetailsModal from '../../components/TaskExecDetailsModal'
import CancelTaskModal from '../../components/CancelTaskModal'
import TaskNotExecutedModal from '../../components/TaskNotExecutedModal'
import { useAuth } from '@shared/context/AuthContext'
import { exportCsv, csvFilename } from '../../utils/exportCsv'
import PaginatedTable from '../../utils/PaginatedTable.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('he-IL')
}

const STATUS = {
  open:         { label: 'פתוח',     cls: 'yellow' },
  in_progress:  { label: 'בביצוע',   cls: 'blue'   },
  done:         { label: 'הושלם',    cls: 'green'  },
  cancelled:    { label: 'בוטל',     cls: 'gray'   },
  not_executed: { label: 'לא בוצעה', cls: 'purple' },
}

export default function TasksTab({ cardId, boxId }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg]   = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTask,   setEditTask]   = useState(null)
  const [detailsTask, setDetailsTask] = useState(null)
  const [cancelTask, setCancelTask] = useState(null)
  const [notExecTask, setNotExecTask] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!boxId) { setLoading(false); return }
    setLoading(true); setErrMsg(null)
    tasksApi.getByCard(cardId, boxId)
      .then(d => { if (!cancelled) setList(Array.isArray(d) ? d : []) })
      .catch(err => { if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת משימות') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cardId, boxId, reloadKey])

  function openTask(t) {
    const isFinal = t.status === 'done' || t.status === 'cancelled' || t.status === 'not_executed'
    if (isFinal) setDetailsTask(t)
    else setEditTask(t)
  }

  function handleTaskSaved(saved) {
    if (!saved) return
    setList(prev => prev.map(t => t.id === saved.id ? { ...t, ...saved } : t))
  }

  return (
    <>
      <div className="entity-actions" style={{ marginBottom: 12 }}>
        <button
          className="btn sm"
          disabled={list.length === 0}
          onClick={() => exportCsv(
            list,
            [
              { key: 'created_at',     label: 'תאריך', format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
              { key: 'type_name',      label: 'סוג' },
              { key: 'status',         label: 'סטטוס', format: (v) => STATUS[v]?.label || v || '' },
              { key: 'assigned_name',  label: 'משויך' },
              { key: 'created_by_name', label: 'נוצר ע"י' },
              { key: 'notes',          label: 'הערות' },
              { key: 'execution_notes', label: 'הערות ביצוע' },
              { key: 'cancellation_reason', label: 'סיבת ביטול' },
              { key: 'not_executed_reason', label: 'סיבת אי-ביצוע' },
              { key: 'executed_at',    label: 'בוצע בתאריך', format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
            ],
            csvFilename(`card_${cardId}_tasks`)
          )}
        >📥 יצוא לאקסל</button>
        {isAdmin && (
          <button
            className="btn sm"
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!boxId}
          >➕ צור משימה</button>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>טוען משימות...</span></div>
      ) : errMsg ? (
        <div className="alert red">{errMsg}</div>
      ) : list.length === 0 ? (
        <div className="empty">אין משימות לכרטסת זו</div>
      ) : (
        <PaginatedTable
          data={list}
          getRowKey={(t) => t.id}
          onRowClick={(t) => openTask(t)}
          header={(
            <tr>
              <th>תאריך</th>
              <th>סוג</th>
              <th>סטטוס</th>
              <th>משויך</th>
              <th>נוצר ע"י</th>
              <th>הערות</th>
              {isAdmin && <th>פעולות</th>}
            </tr>
          )}
          renderRow={(t) => {
            const st = STATUS[t.status] || { label: t.status, cls: 'gray' }
            const isFinal = t.status === 'done' || t.status === 'cancelled' || t.status === 'not_executed'
            return (
              <>
                <td>{formatDate(t.created_at)}</td>
                <td>{t.icon ? `${t.icon} ` : ''}{t.type_name || '—'}</td>
                <td>
                  <span
                    className={'pill ' + st.cls}
                    title={
                      t.status === 'cancelled' && t.cancellation_reason
                        ? `סיבת ביטול: ${t.cancellation_reason}`
                      : t.status === 'not_executed' && t.not_executed_reason
                        ? `סיבת אי-ביצוע: ${t.not_executed_reason}`
                        : undefined
                    }
                  >{st.label}</span>
                </td>
                <td>{t.assigned_name || <span style={{ color: 'var(--text3)' }}>לא משויך</span>}</td>
                <td>{t.created_by_name || '—'}</td>
                <td style={{ maxWidth: 300 }}>{t.notes || '—'}</td>
                {isAdmin && (
                  <td className="actions" style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                    {!isFinal && (
                      <>
                        <button
                          className="btn sm danger"
                          onClick={(e) => { e.stopPropagation(); setNotExecTask(t) }}
                          title="סגור את המשימה כלא בוצעה"
                        >❌ לא בוצעה</button>
                        <button
                          className="btn sm danger"
                          onClick={(e) => { e.stopPropagation(); setCancelTask(t) }}
                          title="העבר את המשימה לסטטוס בוטל"
                        >🚫 בטל</button>
                      </>
                    )}
                  </td>
                )}
              </>
            )
          }}
        />
      )}

      <TaskModal
        open={createOpen}
        defaults={{ box_id: boxId, lockBox: true }}
        onClose={() => setCreateOpen(false)}
        onSaved={() => setReloadKey(k => k + 1)}
      />

      <TaskModal
        open={!!editTask}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSaved={handleTaskSaved}
      />

      <TaskExecDetailsModal
        open={!!detailsTask}
        task={detailsTask}
        onClose={() => setDetailsTask(null)}
      />

      {cancelTask && (
        <CancelTaskModal
          task={cancelTask}
          onClose={() => setCancelTask(null)}
          onCancelled={() => setReloadKey(k => k + 1)}
        />
      )}

      <TaskNotExecutedModal
        open={!!notExecTask}
        task={notExecTask}
        onClose={() => setNotExecTask(null)}
        onSuccess={() => setReloadKey(k => k + 1)}
      />
    </>
  )
}
