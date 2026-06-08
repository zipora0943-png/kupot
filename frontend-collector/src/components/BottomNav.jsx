import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useData } from '@shared/context/DataStoreContext'
import { useAuth } from '@shared/context/AuthContext'

const ITEMS = [
  { icon: '📦', label: 'קופות', path: '/boxes', match: '/boxes' },
  { icon: '💰', label: 'גביה', path: '/collection', match: '/collection' },
  { icon: '🔔', label: 'משימות', path: '/tasks-alerts', match: '/tasks-alerts' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: alertsData } = useData('alertsNoCollection')

  // Maintenance (תחזוקה) has no collection flow — drop the גביה tab.
  const items = user?.role === 'maintenance'
    ? ITEMS.filter((it) => it.path !== '/collection')
    : ITEMS

  // Backend returns { count, items, global_threshold }. Count drives the badge.
  const alertCount = (() => {
    const n = Number(alertsData?.count)
    if (Number.isFinite(n)) return n
    return Array.isArray(alertsData?.items) ? alertsData.items.length : 0
  })()

  function isActive(item) {
    return location.pathname === item.match || location.pathname.startsWith(item.match + '/')
  }

  return (
    <nav className="bottom-nav" role="navigation" aria-label="ניווט ראשי">
      {items.map((item) => {
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
