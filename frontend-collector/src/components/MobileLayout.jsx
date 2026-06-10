import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/context/AuthContext'
import BottomNav from './BottomNav'

export default function MobileLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  // Cashroom users have a single locked screen; the bottom nav (boxes / גביה /
  // משימות) doesn't apply to them and would expose other parts of the app.
  const isCashroom = user?.role === 'cashroom'
  const isAdmin    = user?.role === 'admin'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mobile-layout">
      <header className="mobile-topbar">
        <button
          type="button"
          className="topbar-user"
          onClick={handleLogout}
          aria-label="התנתק"
        >
          <span className="topbar-user-icon" aria-hidden="true">👤</span>
        </button>
        <div className="topbar-username">{user?.name || ''}</div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/logs')}
            aria-label="צפה בלוג"
            title="לוג מערכת"
            style={{
              marginInlineStart: 'auto', background: 'transparent',
              border: 'none', fontSize: 18, padding: 6, cursor: 'pointer',
            }}
          >📋</button>
        )}
        {!isAdmin && <div className="topbar-spacer" aria-hidden="true" />}
      </header>

      <main className="mobile-content">
        <Outlet />
      </main>

      {!isCashroom && <BottomNav />}
    </div>
  )
}
