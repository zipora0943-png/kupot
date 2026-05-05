import React from 'react'
import { NavLink } from 'react-router-dom'

// Sidebar groups — exactly per kupot_wireframe_v10.html admin sidebar
const SECTIONS = [
  {
    label: 'ניהול קופות',
    items: [
      { to: '/cards',     icon: '📋', label: 'כרטסות' },
      { to: '/boxes',     icon: '📦', label: 'קופות' },
      { to: '/envelopes', icon: '✉️', label: 'כל המעטפות' },
    ],
  },
  {
    label: 'תפעול',
    items: [
      { to: '/tasks',   icon: '✅', label: 'משימות',  badgeKey: 'tasks' },
      { to: '/reports', icon: '⚠️', label: 'דיווחים', badgeKey: 'reports' },
      { to: '/alerts',  icon: '🔔', label: 'התראות',  badgeKey: 'alerts' },
    ],
  },
  {
    label: 'ניתוח',
    items: [
      { to: '/dochot',         icon: '📊', label: 'דוחות' },
      { to: '/cashroom-admin', icon: '💰', label: 'חדר כסף' },
    ],
  },
  {
    label: 'הגדרות',
    items: [
      { to: '/users',    icon: '👥', label: 'משתמשים' },
      { to: '/settings', icon: '⚙️', label: 'הגדרות' },
    ],
  },
]

/**
 * @param {{ badges?: { tasks?: number, reports?: number, alerts?: number } }} props
 */
export default function Sidebar({ badges = {} }) {
  return (
    <aside className="sidebar">
      {SECTIONS.map((section) => (
        <div className="sidebar-section" key={section.label}>
          <div className="sidebar-label">{section.label}</div>
          {section.items.map((item) => {
            const badgeVal = item.badgeKey ? badges[item.badgeKey] : null
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-btn' + (isActive ? ' active' : '')}
              >
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
                {badgeVal > 0 && <span className="badge">{badgeVal}</span>}
              </NavLink>
            )
          })}
        </div>
      ))}
    </aside>
  )
}
