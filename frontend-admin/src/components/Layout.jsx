import React, { useState } from 'react'
import { Outlet, useLocation, matchPath, Navigate } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import KeepAliveScreens, { isKeepAlivePath } from './KeepAliveScreens'
import { useAuth } from '@shared/context/AuthContext'
import { defaultPathForRole } from '../utils/defaultPath'

/**
 * Top-level shell for all authenticated pages:
 *   ┌─────────── TopBar ───────────┐
 *   │ Sidebar │      <main>        │
 *   └─────────┴────────────────────┘
 *
 * Task 36: cashroom users see a single locked screen (the cashroom view) with
 * no sidebar at all — they have no access to any other part of the system.
 *
 * <main> hosts two render slots:
 *   - <KeepAliveScreens /> — always mounted; keeps every sidebar screen alive
 *     so state (generated report, filters, scroll) survives navigation.
 *   - <Outlet /> — rendered only for fresh-mount routes (index redirect,
 *     /cards/:id) so each card detail visit starts clean.
 */
export default function Layout({ badges = {} }) {
  const location = useLocation()
  const { user } = useAuth()
  const isCashroom = user?.role === 'cashroom'

  // Bumping refreshNonce remounts <KeepAliveScreens/>, dropping every kept-alive
  // page so they re-fetch on next visit. Triggered from the TopBar refresh button.
  const [refreshNonce, setRefreshNonce] = useState(0)
  const handleRefresh = () => setRefreshNonce((n) => n + 1)

  const onKeepAlive  = isKeepAlivePath(location.pathname)
  const onCardDetail = !!matchPath({ path: '/cards/:id', end: true }, location.pathname)
  const onIndex      = location.pathname === '/'

  // Stray paths (typos, stale links) bounce back to the role's home.
  if (!onKeepAlive && !onCardDetail && !onIndex) {
    return <Navigate to={defaultPathForRole(user?.role)} replace />
  }

  return (
    <>
      <TopBar onRefresh={handleRefresh} />
      <div className="app-layout">
        {!isCashroom && <Sidebar badges={badges} />}
        <main className="main">
          <KeepAliveScreens key={refreshNonce} visible={onKeepAlive} />
          {!onKeepAlive && <Outlet />}
        </main>
      </div>
    </>
  )
}
