import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BottomNav from './BottomNav'

export default function MobileLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
        <div className="topbar-spacer" aria-hidden="true" />
      </header>

      <main className="mobile-content">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
