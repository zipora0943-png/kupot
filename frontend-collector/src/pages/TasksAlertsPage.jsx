import React, { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@shared/context/AuthContext'
import { useData } from '@shared/context/DataStoreContext'
import TaskModal from '../components/TaskModal'
import SelfReportTaskModal from '../components/SelfReportTaskModal'
import ReportModal from '../components/ReportModal'
import ReportViewModal from '../components/ReportViewModal'
import CloseReportModal from '@shared/components/CloseReportModal'

// Hebrew labels for task status — shown in the maintenance "my tasks" history
// (where most tasks are already 'done', so the bare title isn't enough).
const TASK_STATUS_LABELS = {
  open: 'פתוחה',
  in_progress: 'בביצוע',
  done: 'בוצעה',
  cancelled: 'בוטלה',
  not_executed: 'לא בוצעה',
}

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function daysSince(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

export default function TasksAlertsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isMaintenance = user?.role === 'maintenance'
  // Task 50: collector with this permission gets a "+ דווח על משימה שביצעתי" button.
  const canSelfReport = user?.role === 'collector' && !!user?.permissions?.can_self_report_tasks
  const [selfReportOpen, setSelfReportOpen] = useState(false)
  const initialTab = location.state?.tab === 'alerts'
    ? 'alerts'
    : location.state?.tab === 'tasks'
      ? 'tasks'
      : 'all'
  const [tab, setTab] = useState(initialTab)
  const [createOpen, setCreateOpen] = useState(false)
  const [openReport, setOpenReport]   = useState(null)
  const [closeReport, setCloseReport] = useState(null)
  // Maintenance (תחזוקה): two tabs — reports (country-wide) and "my tasks".
  const [maintTab, setMaintTab] = useState(location.state?.tab === 'tasks' ? 'tasks' : 'reports')
  const [viewReport, setViewReport] = useState(null)

  // All three slices come from the DataStore: populated at login, kept
  // current by Socket.IO entity.changed events. Page-level filtering
  // (open vs. all) happens in-memory.
  const { data: tasksAll,    loading: tasksLoading,  refetch: refetchTasks  } = useData('tasks')
  const { data: alertsData,  loading: alertsLoading } = useData('alertsNoCollection')
  const { data: reportsAll,  loading: reportsLoading } = useData('reports')

  const tasksList = useMemo(
    () => (Array.isArray(tasksAll) ? tasksAll.filter((t) => t.status === 'open') : []),
    [tasksAll],
  )
  const alertsList = useMemo(
    () => (Array.isArray(alertsData?.items) ? alertsData.items : []),
    [alertsData],
  )
  const openReports = useMemo(
    () => (isAdmin && Array.isArray(reportsAll) ? reportsAll.filter((r) => r.status === 'open') : []),
    [isAdmin, reportsAll],
  )

  const tasksError   = null
  const alertsError  = null
  const reportsError = null

  // Modal-driven local updates are no-ops now — the socket-triggered refetch
  // brings the latest report into the store. Keeping the prop for compatibility.
  function handleReportSaved() { /* store refreshes via socket */ }

  const reportsCount   = isAdmin ? openReports.length : 0
  const allCount       = tasksList.length + alertsList.length + reportsCount
  const alertsTabCount = alertsList.length + reportsCount

  // ── Maintenance (תחזוקה) gets a dedicated view: country-wide reports +
  // a history of the tasks they reported. No collection alerts, no admin tools.
  if (isMaintenance) {
    const myTasks = Array.isArray(tasksAll) ? tasksAll : []
    const openReportsAll = Array.isArray(reportsAll)
      ? reportsAll.filter((r) => r.status === 'open')
      : []
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            type="button"
            className="btn primary"
            onClick={() => setSelfReportOpen(true)}
          >
            ➕ דווח על משימה שביצעתי
          </button>
        </div>

        <div className="list-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={maintTab === 'reports'}
            className={`list-tab${maintTab === 'reports' ? ' active' : ''}`}
            onClick={() => setMaintTab('reports')}
          >
            דיווחים
            {openReportsAll.length > 0 && <span className="count">{openReportsAll.length}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={maintTab === 'tasks'}
            className={`list-tab${maintTab === 'tasks' ? ' active' : ''}`}
            onClick={() => setMaintTab('tasks')}
          >
            המשימות שלי
            {myTasks.length > 0 && <span className="count">{myTasks.length}</span>}
          </button>
        </div>

        {maintTab === 'reports' && (
          <ReportsList
            list={openReportsAll}
            loading={reportsLoading}
            error={reportsError}
            onClick={(r) => setViewReport(r)}
          />
        )}

        {maintTab === 'tasks' && (
          <TasksList
            list={myTasks}
            loading={tasksLoading}
            error={tasksError}
            onClick={(id) => navigate(`/task/${id}`)}
            emptyText="טרם דיווחת על משימות"
            showStatus
          />
        )}

        <SelfReportTaskModal
          open={selfReportOpen}
          onClose={() => setSelfReportOpen(false)}
          onSaved={() => { setSelfReportOpen(false); refetchTasks() }}
        />

        <ReportViewModal
          open={!!viewReport}
          report={viewReport}
          onClose={() => setViewReport(null)}
        />
      </div>
    )
  }

  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreateOpen(true)}
          >
            ➕ צור משימה
          </button>
        </div>
      )}

      {canSelfReport && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            type="button"
            className="btn primary"
            onClick={() => setSelfReportOpen(true)}
          >
            ➕ דווח על משימה שביצעתי
          </button>
        </div>
      )}

      <div className="list-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={`list-tab${tab === 'all' ? ' active' : ''}`}
          onClick={() => setTab('all')}
        >
          הכל
          {allCount > 0 && <span className="count">{allCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tasks'}
          className={`list-tab${tab === 'tasks' ? ' active' : ''}`}
          onClick={() => setTab('tasks')}
        >
          משימות
          {tasksList.length > 0 && <span className="count">{tasksList.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'alerts'}
          className={`list-tab${tab === 'alerts' ? ' active' : ''}`}
          onClick={() => setTab('alerts')}
        >
          התראות
          {alertsTabCount > 0 && <span className="count">{alertsTabCount}</span>}
        </button>
      </div>

      {tab === 'all' && (
        <>
          <TasksList
            list={tasksList}
            loading={tasksLoading}
            error={tasksError}
            onClick={(id) => navigate(`/task/${id}`)}
            hideEmpty
            sectionTitle="📋 משימות"
          />
          <AlertsList
            list={alertsList}
            loading={alertsLoading}
            error={alertsError}
            onClick={(cardId) => navigate(`/collection/${cardId}`)}
            hideEmpty
            sectionTitle="⚠️ התראות"
          />
          {isAdmin && (
            <ReportsList
              list={openReports}
              loading={reportsLoading}
              error={reportsError}
              onClick={(r) => setOpenReport(r)}
              hideEmpty
            />
          )}
          {!tasksLoading && !alertsLoading && !reportsLoading
            && tasksList.length === 0 && alertsList.length === 0 && reportsCount === 0 && (
            <div className="empty">אין משימות, התראות או דיווחים</div>
          )}
        </>
      )}

      {tab === 'tasks' && (
        <TasksList
          list={tasksList}
          loading={tasksLoading}
          error={tasksError}
          onClick={(id) => navigate(`/task/${id}`)}
        />
      )}

      {tab === 'alerts' && (
        <>
          <AlertsList
            list={alertsList}
            loading={alertsLoading}
            error={alertsError}
            onClick={(cardId) => navigate(`/collection/${cardId}`)}
            hideEmpty={isAdmin}
          />
          {isAdmin && (
            <ReportsList
              list={openReports}
              loading={reportsLoading}
              error={reportsError}
              onClick={(r) => setOpenReport(r)}
              hideEmpty={alertsList.length > 0}
            />
          )}
          {isAdmin && !alertsLoading && !reportsLoading
            && alertsList.length === 0 && openReports.length === 0 && (
            <div className="empty">אין התראות או דיווחים פתוחים</div>
          )}
        </>
      )}

      {isAdmin && (
        <TaskModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); refetchTasks() }}
        />
      )}

      {canSelfReport && (
        <SelfReportTaskModal
          open={selfReportOpen}
          onClose={() => setSelfReportOpen(false)}
          onSaved={() => { setSelfReportOpen(false); refetchTasks() }}
        />
      )}

      {isAdmin && (
        <ReportModal
          open={!!openReport}
          report={openReport}
          onClose={() => setOpenReport(null)}
          onSaved={handleReportSaved}
        />
      )}

      {isAdmin && closeReport && (
        <CloseReportModal
          report={closeReport}
          onClose={() => setCloseReport(null)}
          onClosed={handleReportSaved}
        />
      )}
    </div>
  )
}

function TasksList({ list, loading, error, onClick, hideEmpty, sectionTitle, emptyText, showStatus }) {
  if (loading) return <div className="loading">טוען...</div>
  if (error) return <div className="alert red">{error}</div>
  if (list.length === 0) return hideEmpty ? null : <div className="empty">{emptyText || 'אין משימות פתוחות'}</div>

  return (
    <div>
      {sectionTitle && <div className="simple-row-section-title">{sectionTitle}</div>}
      {list.map((t) => {
        const title = `${t.icon || '📋'} ${t.type_name || 'משימה'}`
        // Task 48: deferred-box installation tasks have no iron_number yet.
        const boxLabel = t.iron_number ? `קופה #${t.iron_number}` : (t.opens_card ? 'קופה חדשה (יוזן בביצוע)' : '')
        const due = t.due_date ? `יעד: ${formatDate(t.due_date)}` : ''
        const statusLabel = showStatus ? (TASK_STATUS_LABELS[t.status] || null) : null
        const meta = [boxLabel, due, statusLabel].filter(Boolean).join(' · ')
        return (
          <div
            key={t.id}
            className="simple-row"
            role="button"
            tabIndex={0}
            onClick={() => onClick(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(t.id)
              }
            }}
          >
            <div className="simple-row-title">{title}</div>
            {meta && <div className="simple-row-meta">{meta}</div>}
            {t.notes && <div className="simple-row-meta">{t.notes}</div>}
          </div>
        )
      })}
    </div>
  )
}

function AlertsList({ list, loading, error, onClick, hideEmpty, sectionTitle }) {
  if (loading) return <div className="loading">טוען...</div>
  if (error) return <div className="alert red">{error}</div>
  if (list.length === 0) return hideEmpty ? null : <div className="empty">אין התראות</div>

  return (
    <div>
      {sectionTitle && <div className="simple-row-section-title">{sectionTitle}</div>}
      {list.map((a) => {
        const title = a.custom_name || `קופה #${a.iron_number ?? ''}`
        const days = Number.isFinite(a.days_since) ? `${a.days_since} ימים ללא גביה` : 'אין גביות'
        const where = [a.city, a.neighborhood, a.street].filter(Boolean).join(', ')
        const meta = [days, where].filter(Boolean).join(' · ')
        return (
          <div
            key={a.card_id}
            className="simple-row"
            role="button"
            tabIndex={0}
            onClick={() => onClick(a.card_id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(a.card_id)
              }
            }}
          >
            <div className="simple-row-title">⚠️ {title}</div>
            <div className="simple-row-meta">{meta}</div>
          </div>
        )
      })}
    </div>
  )
}

function ReportsList({ list, loading, error, onClick, hideEmpty }) {
  if (loading) return <div className="loading">טוען...</div>
  if (error) return <div className="alert red">{error}</div>
  if (list.length === 0) return hideEmpty ? null : <div className="empty">אין דיווחים פתוחים</div>

  return (
    <div>
      <div className="simple-row-section-title">📋 דיווחים פתוחים</div>
      {list.map((r) => {
        const title = `${r.icon || '📋'} ${r.type_name || 'דיווח'}`
        const boxLabel = r.iron_number ? `קופה #${r.iron_number}` : ''
        const days = daysSince(r.created_at)
        const daysLabel = days != null ? `${days} ימים פתוח` : ''
        const meta = [boxLabel, daysLabel].filter(Boolean).join(' · ')
        return (
          <div
            key={r.id}
            className="simple-row"
            role="button"
            tabIndex={0}
            onClick={() => onClick(r)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(r)
              }
            }}
          >
            <div className="simple-row-title">{title}</div>
            {meta && <div className="simple-row-meta">{meta}</div>}
            {r.description && <div className="simple-row-meta">{r.description}</div>}
          </div>
        )
      })}
    </div>
  )
}
