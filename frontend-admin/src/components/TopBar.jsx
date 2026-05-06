import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  admin: 'מנהל',
  collector: 'גובה',
  cashroom: 'חדר כסף',
}

export default function TopBar({ onRefresh }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="topbar">
      <div className="user-info">
        {user && (
          <>
            <span className="name">{user.name}</span>
            <span>·</span>
            <span>{ROLE_LABELS[user.role] || user.role}</span>
            {onRefresh && (
              <button
                className="refresh-btn"
                onClick={onRefresh}
                title="רענן נתונים — טעינה מחדש של כל המסכים"
              >
                <span className="refresh-icon">↻</span> רענן נתונים
              </button>
            )}
            <button className="logout-btn" onClick={handleLogout}>
              יציאה
            </button>
          </>
        )}
      </div>
      <div className="logo">📦 פרויקט קופות — ממשק מנהל</div>
    </div>
  )
}
