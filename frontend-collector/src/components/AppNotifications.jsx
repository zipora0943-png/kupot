import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/context/AuthContext'
import { useData } from '@shared/context/DataStoreContext'
import {
  initAudioUnlock, ensureNotifPermission, playBell,
  postSystemNotification, appIsHidden, isNative,
} from '../utils/notify'
import { logger } from '../utils/logger'

// ===== New task / new report alerts =====
// Watches the DataStore snapshots for *additions* and raises an alert:
//   - collector / installer  → a new task assigned to them
//   - admin (manager)        → a new report, or a task a worker just executed
//
// The DataStore already keeps `tasks` and `reports` current via the Socket.IO
// `entity.changed` pipeline and already scopes each role's data on the backend
// (a collector only sees their own tasks), so diffing the snapshot here gives
// us correctly-targeted alerts without any backend change.
//
// On the first populated snapshot we only record a baseline — we never chime
// for items that already existed before the user opened the app.

const NAV_TARGET = '/tasks-alerts'
const BANNER_TTL_MS = 6000

// Coalesce a burst of same-kind events into one line (e.g. a bulk import).
function describe(kind, count) {
  if (kind === 'task_new') {
    return count > 1
      ? { title: '📋 משימות חדשות', body: `התקבלו ${count} משימות חדשות` }
      : { title: '📋 משימה חדשה', body: 'התקבלה משימה חדשה' }
  }
  if (kind === 'task_done') {
    return count > 1
      ? { title: '✅ משימות בוצעו', body: `${count} משימות דווחו כבוצעו` }
      : { title: '✅ משימה בוצעה', body: 'עובד דיווח על ביצוע משימה' }
  }
  // report_new
  return count > 1
    ? { title: '🛎️ דיווחים חדשים', body: `התקבלו ${count} דיווחים חדשים` }
    : { title: '🛎️ דיווח חדש', body: 'התקבל דיווח חדש' }
}

export default function AppNotifications() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const role = user?.role
  const { data: tasks } = useData('tasks')
  const { data: reports } = useData('reports')

  const [banners, setBanners] = useState([]) // [{ key, title, body }]
  const bannerSeq = useRef(0)

  // Baselines — null means "not yet initialized for this user".
  const taskStatusRef = useRef(null) // Map<id, status>
  const reportIdsRef = useRef(null)  // Set<id of open reports>
  const userIdRef = useRef(undefined)

  const addBanner = useCallback((title, body) => {
    const key = ++bannerSeq.current
    setBanners((prev) => [...prev, { key, title, body }])
    setTimeout(() => {
      setBanners((prev) => prev.filter((b) => b.key !== key))
    }, BANNER_TTL_MS)
  }, [])

  // Deliver one alert: system-tray notification when backgrounded, otherwise an
  // in-app banner + bell. We play the bell once per delivery batch.
  const deliver = useCallback((notifications) => {
    if (!notifications.length) return
    if (appIsHidden() && isNative()) {
      for (const n of notifications) postSystemNotification(n)
    } else {
      playBell()
      for (const n of notifications) addBanner(n.title, n.body)
    }
    logger.log('notify', 'alert', notifications.map((n) => n.title).join(' | '))
  }, [addBanner])

  // ── one-time: unlock audio + ask for notification permission after login ──
  useEffect(() => {
    if (!isAuthenticated || !role) return
    initAudioUnlock()
    ensureNotifPermission()
  }, [isAuthenticated, role])

  // ── detection ──
  useEffect(() => {
    if (!isAuthenticated || !role) return

    // Reset the baseline whenever the logged-in user changes.
    if (userIdRef.current !== user?.id) {
      userIdRef.current = user?.id
      taskStatusRef.current = null
      reportIdsRef.current = null
    }

    const isField = role === 'collector' || role === 'maintenance'
    const isManager = role === 'admin'
    const events = [] // { kind }

    // tasks
    if (Array.isArray(tasks)) {
      const prev = taskStatusRef.current
      const next = new Map(tasks.map((t) => [t.id, t.status]))
      if (prev) {
        for (const [id, status] of next) {
          const before = prev.get(id)
          if (isField) {
            // newly-assigned task (not seen before, still open)
            if (before === undefined && (status === 'open' || status === 'in_progress')) {
              events.push('task_new')
            }
          } else if (isManager) {
            // a worker executed a task: either a new id that arrives already
            // done (self-report), or an existing task that flipped to done.
            if (status === 'done' && before !== 'done') {
              events.push('task_done')
            }
          }
        }
      }
      taskStatusRef.current = next
    }

    // reports (manager only)
    if (isManager && Array.isArray(reports)) {
      const prev = reportIdsRef.current
      const next = new Set(reports.filter((r) => r.status === 'open').map((r) => r.id))
      if (prev) {
        for (const id of next) {
          if (!prev.has(id)) events.push('report_new')
        }
      }
      reportIdsRef.current = next
    }

    if (events.length) {
      const counts = events.reduce((acc, k) => ({ ...acc, [k]: (acc[k] || 0) + 1 }), {})
      const notifications = Object.entries(counts).map(([kind, count]) => describe(kind, count))
      deliver(notifications)
    }
  }, [tasks, reports, role, isAuthenticated, user?.id, deliver])

  if (!banners.length) return null

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        right: 8,
        zIndex: 4000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {banners.map((b) => (
        <div
          key={b.key}
          role="button"
          tabIndex={0}
          onClick={() => { setBanners([]); navigate(NAV_TARGET) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { setBanners([]); navigate(NAV_TARGET) }
          }}
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            background: '#1f6feb',
            color: '#fff',
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15 }}>{b.title}</div>
          <div style={{ fontSize: 13, opacity: 0.92 }}>{b.body}</div>
        </div>
      ))}
    </div>
  )
}
