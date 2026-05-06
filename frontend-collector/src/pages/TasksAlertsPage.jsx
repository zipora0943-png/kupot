import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  tasks as tasksApi,
  alerts as alertsApi,
  reports as reportsApi,
} from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import TaskModal from '../components/TaskModal'
import ReportModal from '../components/ReportModal'
import CloseReportModal from '../components/CloseReportModal'

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
  const initialTab = location.state?.tab === 'alerts'
    ? 'alerts'
    : location.state?.tab === 'tasks'
      ? 'tasks'
      : 'all'
  const [tab, setTab] = useState(initialTab)
  const [createOpen, setCreateOpen] = useState(false)

  const [tasksList, setTasksList] = useState([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasksError, setTasksError] = useState(null)

  const [alertsList, setAlertsList] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState(null)

  const [openReports, setOpenReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState(null)
  const [openReport, setOpenReport]   = useState(null)
  const [closeReport, setCloseReport] = useState(null)

  const loadTasks = useCallback(() => {
    let cancelled = false
    setTasksLoading(true)
    setTasksError(null)
    tasksApi.getAll({ status: 'open' })
      .then((rows) => { if (!cancelled) setTasksList(Array.isArray(rows) ? rows : []) })
      .catch((err) => { if (!cancelled) setTasksError(err.message || 'שגיאה בטעינת המשימות') })
      .finally(() => { if (!cancelled) setTasksLoading(false) })
    return () => { cancelled = true }
  }, [])

  const loadAlerts = useCallback(() => {
    let cancelled = false
    setAlertsLoading(true)
    setAlertsError(null)
    alertsApi.noCollection()
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data?.items) ? data.items : []
        setAlertsList(items)
        try { window.dispatchEvent(new CustomEvent('alerts:refresh', { detail: items.length })) } catch (_) { /* no-op */ }
      })
      .catch((err) => { if (!cancelled) setAlertsError(err.message || 'שגיאה בטעינת ההתראות') })
      .finally(() => { if (!cancelled) setAlertsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const loadReports = useCallback(() => {
    if (!isAdmin) return undefined
    let cancelled = false
    setReportsLoading(true)
    setReportsError(null)
    reportsApi.getAll({ status: 'open' })
      .then((rows) => { if (!cancelled) setOpenReports(Array.isArray(rows) ? rows : []) })
      .catch((err) => { if (!cancelled) setReportsError(err.message || 'שגיאה בטעינת הדיווחים') })
      .finally(() => { if (!cancelled) setReportsLoading(false) })
    return () => { cancelled = true }
  }, [isAdmin])

  useEffect(() => {
    const c1 = loadTasks()
    const c2 = loadAlerts()
    const c3 = loadReports()
    return () => { c1?.(); c2?.(); c3?.() }
  }, [loadTasks, loadAlerts, loadReports])

  function handleReportSaved(updated) {
    if (!updated) return
    setOpenReports(prev => {
      if (updated.status && updated.status !== 'open') {
        return prev.filter(r => r.id !== updated.id)
      }
      return prev.map(r => r.id === updated.id ? { ...r, ...updated } : r)
    })
  }

  const reportsCount = isAdmin ? openReports.length : 0
  const allCount = tasksList.length + alertsList.length + reportsCount
  const alertsTabCount = alertsList.length + reportsCount

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
          onSaved={() => { setCreateOpen(false); loadTasks() }}
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
          onClosed={(updated) => {
            handleReportSaved(updated)
            loadReports()
          }}
        />
      )}
    </div>
  )
}

function TasksList({ list, loading, error, onClick, hideEmpty, sectionTitle }) {
  if (loading) return <div className="loading">טוען...</div>
  if (error) return <div className="alert red">{error}</div>
  if (list.length === 0) return hideEmpty ? null : <div className="empty">אין משימות פתוחות</div>

  return (
    <div>
      {sectionTitle && <div className="simple-row-section-title">{sectionTitle}</div>}
      {list.map((t) => {
        const title = `${t.icon || '📋'} ${t.type_name || 'משימה'}`
        const boxLabel = t.iron_number ? `קופה #${t.iron_number}` : ''
        const due = t.due_date ? `יעד: ${formatDate(t.due_date)}` : ''
        const meta = [boxLabel, due].filter(Boolean).join(' · ')
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
