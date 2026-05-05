import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const ITEMS = [
  { icon: '📦', label: 'קופות', path: '/boxes', match: '/boxes' },
  { icon: '💰', label: 'גביה', path: '/collection', match: '/collection' },
  { icon: '🔔', label: 'משימות', path: '/tasks-alerts', match: '/tasks-alerts' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  function isActive(item) {
    return location.pathname === item.match || location.pathname.startsWith(item.match + '/')
  }

  return (
    <nav className="bottom-nav" role="navigation" aria-label="ניווט ראשי">
      {ITEMS.map((item) => {
        const active = isActive(item)
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
          </button>
        )
      })}
    </nav>
  )
}
