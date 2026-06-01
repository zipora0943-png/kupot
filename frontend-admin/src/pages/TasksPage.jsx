import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData, useBootstrap } from '@shared/context/DataStoreContext'
import { computeCardLabels } from '@shared/utils/cardLabel'
import TaskExecModal from '../components/TaskExecModal'
import TaskExecDetailsModal from '../components/TaskExecDetailsModal'
import TaskModal from '../components/TaskModal'
import CancelTaskModal from '../components/CancelTaskModal'
import TaskNotExecutedModal from '../components/TaskNotExecutedModal'
import { useAuth } from '@shared/context/AuthContext'
import { tasks as tasksApi } from '../api/endpoints'
import { exportCsv, csvFilename } from '../utils/exportCsv'
import { useSortable, SortableTh } from '../utils/sortable.jsx'
import PaginatedTable from '../utils/PaginatedTable.jsx'

const STATUS_LABELS = {
  open:         { label: 'פתוח',     pill: 'yellow' },
  in_progress:  { label: 'בטיפול',   pill: 'blue'   },
  done:         { label: 'הושלם',    pill: 'green'  },
  cancelled:    { label: 'בוטל',     pill: 'gray'   },
  not_executed: { label: 'לא בוצעה', pill: 'purple' },
}

export default function TasksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Tasks, cards, reports come from the central DataStore — populated at
  // login, kept live via Socket.IO. Task types are part of /initial-load.
  const { data: tasksData,   loading } = useData('tasks')
  const { data: cardsData            } = useData('cards')
  const { data: reportsData          } = useData('reports')
  const bootstrap = useBootstrap()
  const allTasks   = useMemo(() => (Array.isArray(tasksData)   ? tasksData   : []), [tasksData])
  const allCards   = useMemo(() => (Array.isArray(cardsData)   ? cardsData   : []), [cardsData])
  const allReports = useMemo(() => (Array.isArray(reportsData) ? reportsData : []), [reportsData])
  const types      = useMemo(
    () => (Array.isArray(bootstrap?.task_types) ? bootstrap.task_types : []),
    [bootstrap],
  )
  const errMsg = null

  // filters
  const [search,    setSearch]    = useState('')
  const [status,    setStatus]    = useState('')
  const [typeId,    setTypeId]    = useState('')
  const [assignee,  setAssignee]  = useState('')
  const [month,     setMonth]     = useState('') // YYYY-MM, filters by executed_at

  // Special pseudo-value for the type filter: "installations + transfer"
  // (task types with opens_card = TRUE — i.e. התקנה and העברת מיקום).
  const INSTALL_GROUP = '_install_group'

  // exec modal
  const [execTask, setExecTask] = useState(null)

  // exec-details (read-only) modal
  const [detailsTask, setDetailsTask] = useState(null)

  // create / edit modal
  // editTask = null & open = false → closed; open without task → create; with task → edit
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editTask,      setEditTask]      = useState(null)

  // cancel modal
  const [cancelTask, setCancelTask] = useState(null)

  // not-executed modal
  const [notExecTask, setNotExecTask] = useState(null)

  // After mutations the backend NOTIFY trigger refreshes the relevant store
  // slices. Modal callbacks are kept for API compatibility but no longer need
  // to patch local state.
  function handleExecSuccess() { /* store refreshes via socket */ }
  function handleCancelled()   { /* store refreshes via socket */ }
  function handleNotExecuted() { /* store refreshes via socket */ }
  function handleTaskSaved()   { /* store refreshes via socket */ }

  // Admin-only permanent delete. The store refreshes via the socket NOTIFY
  // trigger once the row is gone. Backend blocks (409) a task linked to a report.
  async function handleDelete(t) {
    const label = t.type_name || `#${t.id}`
    if (!window.confirm(`למחוק לצמיתות את המשימה "${label}"?\nפעולה זו אינה הפיכה.`)) return
    try {
      await tasksApi.remove(t.id)
    } catch (err) {
      alert(err.message || 'שגיאה במחיקה')
    }
  }

  function openCreate() {
    setEditTask(null)
    setTaskModalOpen(true)
  }
  function openEdit(t) {
    setEditTask(t)
    setTaskModalOpen(true)
  }
  function closeTaskModal() {
    setTaskModalOpen(false)
    setEditTask(null)
  }

  // Card labels (1019A...)
  const labels = useMemo(() => computeCardLabels(allCards), [allCards])

  // Map<task_id, report> — to determine source
  const reportByTaskId = useMemo(() => {
    const m = new Map()
    for (const r of allReports) {
      if (r.task_id) m.set(r.task_id, r)
    }
    return m
  }, [allReports])

  // distinct assignees from tasks list
  const assignees = useMemo(() => {
    const m = new Map()
    allTasks.forEach(t => {
      if (t.assigned_to && t.assigned_name) m.set(t.assigned_to, t.assigned_name)
    })
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'))
  }, [allTasks])

  // counts by status (for stats)
  const stats = useMemo(() => {
    const c = { open: 0, in_progress: 0, done: 0 }
    for (const t of allTasks) {
      if (c[t.status] !== undefined) c[t.status]++
    }
    return c
  }, [allTasks])

  // Set of task_type IDs that count as "installations" — opens_card = TRUE.
  // Covers התקנה (opens only) and העברת מיקום (opens + closes).
  const installTypeIds = useMemo(() => {
    const s = new Set()
    for (const t of types) {
      if (t.opens_card) s.add(t.id)
    }
    return s
  }, [types])

  // apply filters
  const filtered = useMemo(() => {
    let list = allTasks
    if (status)   list = list.filter(t => t.status === status)
    if (typeId) {
      if (typeId === INSTALL_GROUP) {
        list = list.filter(t => installTypeIds.has(t.task_type_id))
      } else {
        list = list.filter(t => String(t.task_type_id) === String(typeId))
      }
    }
    if (assignee) list = list.filter(t => String(t.assigned_to) === String(assignee))
    if (month) {
      // month is YYYY-MM — filter by executed_at falling inside that month.
      // Tasks without executed_at are excluded when a month is selected.
      list = list.filter(t => {
        if (!t.executed_at) return false
        const d = new Date(t.executed_at)
        if (Number.isNaN(d.getTime())) return false
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        return `${y}-${m}` === month
      })
    }
    if (search) {
      const q = search.trim().toLowerCase()
      list = list.filter(t => {
        const label = t.card_id ? (labels.get(t.card_id) || '') : ''
        return [t.iron_number, t.type_name, t.assigned_name, t.notes, t.id, label]
          .filter(v => v !== null && v !== undefined && v !== '')
          .some(v => String(v).toLowerCase().includes(q))
      })
    }
    return list
  }, [allTasks, status, typeId, assignee, search, month, labels, installTypeIds])

  // Breakdown of the filtered list by status — used in the summary row.
  const filteredBreakdown = useMemo(() => {
    const c = { open: 0, in_progress: 0, done: 0, cancelled: 0, not_executed: 0 }
    for (const t of filtered) {
      if (c[t.status] !== undefined) c[t.status]++
    }
    return c
  }, [filtered])

  function resetFilters() {
    setSearch(''); setStatus(''); setTypeId(''); setAssignee(''); setMonth('')
  }

  const sortAccessors = useMemo(() => ({
    type:     (t) => t.type_name,
    iron:     (t) => t.iron_number,
    card:     (t) => t.card_id ? (labels.get(t.card_id) || '') : '',
    status:   (t) => STATUS_LABELS[t.status]?.label || t.status,
    executed: (t) => t.executed_at ? new Date(t.executed_at) : null,
    assigned: (t) => t.assigned_name,
    source:   (t) => reportByTaskId.get(t.id) ? 1 : 0,
  }), [labels, reportByTaskId])
  const { sorted, sort, toggle } = useSortable(filtered, sortAccessors)

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">משימות</div>
          <div className="page-subtitle">ניהול משימות שטח של הגובים</div>
        </div>
        <div className="entity-actions">
          <button
            className="btn sm"
            disabled={filtered.length === 0}
            onClick={() => exportCsv(
              filtered,
              [
                { key: 'type_name',     label: 'סוג' },
                { key: 'iron_number',   label: 'קופה' },
                { key: 'card_id',       label: 'כרטסת',       format: (v) => v ? (labels.get(v) || `#${v}`) : '' },
                { key: 'status',        label: 'סטטוס',       format: (v) => STATUS_LABELS[v]?.label || v || '' },
                { key: 'assigned_name', label: 'משויך' },
                { key: 'id',            label: 'מקור',        format: (_v, row) => reportByTaskId.get(row.id) ? `דיווח #${reportByTaskId.get(row.id).id}` : 'ידני' },
                { key: 'created_at',    label: 'נוצר',        format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
                { key: 'executed_at',   label: 'בוצע',        format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
                { key: 'notes',         label: 'הערות' },
                { key: 'execution_notes', label: 'הערות ביצוע' },
              { key: 'cancellation_reason', label: 'סיבת ביטול' },
              { key: 'not_executed_reason', label: 'סיבת אי-ביצוע' },
              ],
              csvFilename('tasks')
            )}
          >📥 יצוא לאקסל</button>
          {isAdmin && (
            <button className="btn primary" onClick={openCreate}>➕ צור משימה</button>
          )}
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row stats-3">
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--yellow)' }}>{stats.open}</div>
          <div className="lbl">פתוחות</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--accent)' }}>{stats.in_progress}</div>
          <div className="lbl">בטיפול</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--green)' }}>{stats.done}</div>
          <div className="lbl">הושלמו</div>
        </div>
      </div>

      {/* PANEL */}
      <div className="panel">
        <div className="filters-row">
          <div className="field grow">
            <label>חיפוש</label>
            <input
              placeholder="קופה / כרטסת / סוג / משויך / הערות"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label>סטטוס</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">הכל</option>
              <option value="open">פתוח</option>
              <option value="in_progress">בטיפול</option>
              <option value="done">הושלם</option>
              <option value="cancelled">בוטל</option>
              <option value="not_executed">לא בוצעה</option>
            </select>
          </div>
          <div className="field">
            <label>סוג</label>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">הכל</option>
              <option value={INSTALL_GROUP}>התקנות (כולל העברה)</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>משויך</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">הכל</option>
              {assignees.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>חודש ביצוע</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <button className="btn sm" onClick={resetFilters}>↺ איפוס</button>
        </div>

        <div className="actions" style={{ marginBottom: 12 }}>
          <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text2)' }}>
            סה"כ: <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong>
          </div>
        </div>

        {errMsg && <div className="alert red">{errMsg}</div>}

        {loading ? (
          <div className="loading"><div className="spinner" /><span>טוען משימות...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty">לא נמצאו משימות התואמות את הסינון</div>
        ) : (
          <PaginatedTable
            data={sorted}
            getRowKey={(t) => t.id}
            header={(
              <tr>
                <SortableTh sortKey="type"     sort={sort} onToggle={toggle}>סוג</SortableTh>
                <SortableTh sortKey="iron"     sort={sort} onToggle={toggle}>קופה</SortableTh>
                <SortableTh sortKey="card"     sort={sort} onToggle={toggle}>כרטסת</SortableTh>
                <SortableTh sortKey="status"   sort={sort} onToggle={toggle}>סטטוס</SortableTh>
                <SortableTh sortKey="executed" sort={sort} onToggle={toggle}>תאריך ביצוע</SortableTh>
                <SortableTh sortKey="assigned" sort={sort} onToggle={toggle}>משויך</SortableTh>
                <SortableTh sortKey="source"   sort={sort} onToggle={toggle}>מקור</SortableTh>
                <th>פעולות</th>
              </tr>
            )}
            footer={(
              <tr className="summary-row">
                <td colSpan={8} style={{ textAlign: 'center', fontWeight: 600, background: 'var(--bg2, rgba(0,0,0,0.03))' }}>
                  סה"כ: <strong>{filtered.length}</strong> משימות
                  {' · '}
                  הושלמו: <strong style={{ color: 'var(--green)' }}>{filteredBreakdown.done}</strong>
                  {' · '}
                  פתוחות: <strong style={{ color: 'var(--yellow)' }}>{filteredBreakdown.open}</strong>
                  {' · '}
                  בטיפול: <strong style={{ color: 'var(--accent)' }}>{filteredBreakdown.in_progress}</strong>
                  {filteredBreakdown.not_executed > 0 && (
                    <> {' · '} לא בוצעו: <strong style={{ color: 'var(--purple, #a855f7)' }}>{filteredBreakdown.not_executed}</strong></>
                  )}
                  {filteredBreakdown.cancelled > 0 && (
                    <> {' · '} בוטלו: <strong style={{ color: 'var(--text2)' }}>{filteredBreakdown.cancelled}</strong></>
                  )}
                </td>
              </tr>
            )}
            renderRow={(t) => {
              const st = STATUS_LABELS[t.status] || { label: t.status, pill: 'gray' }
              const cardLabel = t.card_id
                ? (labels.get(t.card_id) || `#${t.card_id}`)
                : null
              const sourceReport = reportByTaskId.get(t.id)
              const isDone = t.status === 'done' || t.status === 'cancelled' || t.status === 'not_executed'
              return (
                <>
                  <td>
                    {t.icon ? `${t.icon} ` : ''}
                    {t.type_name || '—'}
                  </td>
                  <td><strong>{t.iron_number || '—'}</strong></td>
                  <td>
                    {cardLabel ? (
                      <span
                        className="clickable"
                        style={{ color: 'var(--accent)', cursor: 'pointer' }}
                        onClick={() => navigate(`/cards/${t.card_id}`)}
                      >{cardLabel}</span>
                    ) : '—'}
                  </td>
                  <td>
                    <span
                      className={'pill ' + st.pill}
                      title={
                        t.status === 'cancelled' && t.cancellation_reason
                          ? `סיבת ביטול: ${t.cancellation_reason}`
                        : t.status === 'not_executed' && t.not_executed_reason
                          ? `סיבת אי-ביצוע: ${t.not_executed_reason}`
                          : undefined
                      }
                    >{st.label}</span>
                  </td>
                  <td>
                    {t.executed_at
                      ? new Date(t.executed_at).toLocaleDateString('he-IL')
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td>{t.assigned_name || <span style={{ color: 'var(--text3)' }}>לא משויך</span>}</td>
                  <td>
                    {sourceReport
                      ? <span style={{ color: 'var(--text2)' }}>דיווח #{sourceReport.id}</span>
                      : <span style={{ color: 'var(--text3)' }}>ידני</span>}
                  </td>
                  <td className="actions" style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                    {isDone ? (
                      <button
                        className="btn sm"
                        onClick={() => setDetailsTask(t)}
                      >פרטי ביצוע</button>
                    ) : (
                      <>
                        <button
                          className="btn sm"
                          onClick={() => openEdit(t)}
                        >פרטים</button>
                        <button
                          className="btn sm success"
                          onClick={() => setExecTask(t)}
                        >אישור ביצוע</button>
                        <button
                          className="btn sm danger"
                          onClick={() => setNotExecTask(t)}
                          title="סגור את המשימה כלא בוצעה"
                        >❌ לא בוצעה</button>
                        {isAdmin && (
                          <button
                            className="btn sm danger"
                            onClick={() => setCancelTask(t)}
                            title="העבר את המשימה לסטטוס בוטל"
                          >🚫 בטל</button>
                        )}
                      </>
                    )}
                    {isAdmin && (
                      <button
                        className="btn sm danger"
                        onClick={() => handleDelete(t)}
                        title="מחיקה לצמיתות"
                      >🗑 מחק</button>
                    )}
                  </td>
                </>
              )
            }}
          />
        )}
      </div>

      <TaskExecModal
        open={!!execTask}
        task={execTask}
        onClose={() => setExecTask(null)}
        onSuccess={handleExecSuccess}
        onReportNotExecuted={(t) => { setExecTask(null); setNotExecTask(t) }}
      />

      <TaskNotExecutedModal
        open={!!notExecTask}
        task={notExecTask}
        onClose={() => setNotExecTask(null)}
        onSuccess={handleNotExecuted}
      />

      <TaskExecDetailsModal
        open={!!detailsTask}
        task={detailsTask}
        onClose={() => setDetailsTask(null)}
      />

      <TaskModal
        open={taskModalOpen}
        task={editTask}
        onClose={closeTaskModal}
        onSaved={handleTaskSaved}
      />

      {cancelTask && (
        <CancelTaskModal
          task={cancelTask}
          onClose={() => setCancelTask(null)}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  )
}
