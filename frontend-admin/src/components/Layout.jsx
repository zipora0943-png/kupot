import React from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'

/**
 * Top-level shell for all authenticated pages:
 *   ┌─────────── TopBar ───────────┐
 *   │ Sidebar │      <Outlet/>     │
 *   └─────────┴────────────────────┘
 *
 * `badges` are passed to the Sidebar so navigation buttons show counts.
 * For now we pass empty defaults; later the dashboard / app shell can
 * fetch live counts (open tasks, reports, alerts) and pass them in.
 */
export default function Layout({ badges = {} }) {
  return (
    <>
      <TopBar />
      <div className="app-layout">
        <Sidebar badges={badges} />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </>
  )
}
