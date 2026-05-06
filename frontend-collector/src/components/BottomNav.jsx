import React, { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { alerts as alertsApi } from '../api/endpoints'

const ITEMS = [
  { icon: '📦', label: 'קופות', path: '/boxes', match: '/boxes' },
  { icon: '💰', label: 'גביה', path: '/collection', match: '/collection' },
  { icon: '🔔', label: 'משימות', path: '/tasks-alerts', match: '/tasks-alerts' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [alertCount, setAlertCount] = useState(0)
  const lastFetched = useRef(0)

  function isActive(item) {
    return location.pathname === item.match || location.pathname.startsWith(item.match + '/')
  }

  function refresh() {
    lastFetched.current = Date.now()
    alertsApi.noCollection()
      .then((data) => {
        const n = Number(data?.count)
        setAlertCount(Number.isFinite(n) ? n : 0)
      })
      .catch(() => { /* keep previous count */ })
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (location.pathname === '/tasks-alerts' || location.pathname.startsWith('/tasks-alerts/')) {
      refresh()
    }
  }, [location.pathname])

  useEffect(() => {
    function onAlertsRefresh(e) {
      const n = Number(e?.detail)
      if (Number.isFinite(n)) setAlertCount(n)
    }
    window.addEventListener('alerts:refresh', onAlertsRefresh)
    return () => window.removeEventListener('alerts:refresh', onAlertsRefresh)
  }, [])

  return (
    <nav className="bottom-nav" role="navigation" aria-label="ניווט ראשי">
      {ITEMS.map((item) => {
        const active = isActive(item)
        const showBadge = item.path === '/tasks-alerts' && alertCount > 0
        return (
          <button
            key={item.path}
            type="button"
            className={`bottom-nav-item${active ? ' active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
            {showBadge && (
              <span className="bottom-nav-badge" aria-label={`${alertCount} התראות`}>
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
