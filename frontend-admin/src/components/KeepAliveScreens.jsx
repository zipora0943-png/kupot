import React, { useEffect, useState } from 'react'
import { useLocation, matchPath } from 'react-router-dom'

import CardsPage         from '../pages/CardsPage'
import BoxesPage         from '../pages/BoxesPage'
import EnvelopesPage     from '../pages/EnvelopesPage'
import TasksPage         from '../pages/TasksPage'
import ReportsPage       from '../pages/ReportsPage'
import AlertsPage        from '../pages/AlertsPage'
import DochotPage        from '../pages/DochotPage'
import CashroomAdminPage from '../pages/CashroomAdminPage'
import UsersPage         from '../pages/UsersPage'
import SettingsPage      from '../pages/SettingsPage'
import ImportBoxesPage   from '../pages/ImportBoxesPage'

// Each entry's <element/> is mounted on first visit and kept mounted afterward;
// inactive ones are toggled to display:none so their state survives navigation.
const ROUTES = [
  { path: '/cards',          element: <CardsPage /> },
  { path: '/boxes',          element: <BoxesPage /> },
  { path: '/envelopes',      element: <EnvelopesPage /> },
  { path: '/tasks',          element: <TasksPage /> },
  { path: '/reports',        element: <ReportsPage /> },
  { path: '/alerts',         element: <AlertsPage /> },
  { path: '/dochot',         element: <DochotPage /> },
  { path: '/cashroom-admin', element: <CashroomAdminPage /> },
  { path: '/users',          element: <UsersPage /> },
  { path: '/settings',       element: <SettingsPage /> },
  { path: '/import-boxes',   element: <ImportBoxesPage /> },
]

export const KEEP_ALIVE_PATHS = ROUTES.map((r) => r.path)

export function isKeepAlivePath(pathname) {
  return KEEP_ALIVE_PATHS.some((p) => matchPath({ path: p, end: true }, pathname))
}

/**
 * Keeps each sidebar screen mounted across navigation, so state (generated
 * reports, filters, scroll, etc.) survives switching tabs.
 *
 * `visible` toggles the whole subtree off-screen (display:none) without
 * unmounting — used when the URL is on a non-keep-alive route like
 * /cards/:id, so the kept-alive pages stay alive in the background.
 *
 * Browser refresh (F5) drops the in-memory state — this is intentional.
 */
export default function KeepAliveScreens({ visible }) {
  const location = useLocation()
  const [mounted, setMounted] = useState(() => new Set())

  const activePath = visible
    ? ROUTES.find((r) => matchPath({ path: r.path, end: true }, location.pathname))?.path ?? null
    : null

  useEffect(() => {
    if (!activePath) return
    setMounted((prev) => {
      if (prev.has(activePath)) return prev
      const next = new Set(prev)
      next.add(activePath)
      return next
    })
  }, [activePath])

  return (
    <div style={{ display: visible ? 'block' : 'none' }}>
      {ROUTES.map((r) => {
        const isActive = r.path === activePath
        if (!mounted.has(r.path) && !isActive) return null
        return (
          <div
            key={r.path}
            style={{ display: isActive ? 'block' : 'none' }}
            aria-hidden={!isActive}
          >
            {r.element}
          </div>
        )
      })}
    </div>
  )
}
