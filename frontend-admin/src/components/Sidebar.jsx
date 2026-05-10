import React, { useEffect, useState } from 'react'
import { Link, useLocation, matchPath } from 'react-router-dom'
import { useAuth } from '@shared/context/AuthContext'

// Sidebar groups — exactly per kupot_wireframe_v10.html admin sidebar.
// Each item may declare `roles: [...]` to restrict visibility (default: all roles).
const SECTIONS = [
  {
    label: 'ניהול קופות',
    items: [
      { to: '/cards',     icon: '📋', label: 'כרטסות' },
      { to: '/boxes',     icon: '📦', label: 'קופות',       roles: ['admin'] },
      { to: '/envelopes', icon: '✉️', label: 'כל המעטפות',  roles: ['admin'] },
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
      { to: '/dochot',         icon: '📊', label: 'דוחות',    roles: ['admin'] },
      { to: '/cashroom-admin', icon: '💰', label: 'חדר כסף', roles: ['admin', 'cashroom'] },
    ],
  },
  {
    label: 'הגדרות',
    items: [
      { to: '/users',    icon: '👥', label: 'משתמשים', roles: ['admin'] },
      { to: '/settings', icon: '⚙️', label: 'הגדרות',  roles: ['admin'] },
    ],
  },
]

// /cards is the only sidebar entry whose section has nested routes (/cards/:id).
// We track the last URL the user visited inside it, so clicking the sidebar
// "כרטסות" link from another section restores the card detail they had open.
function isInCardsSection(pathname) {
  return pathname === '/cards' || !!matchPath({ path: '/cards/:id', end: true }, pathname)
}

/**
 * @param {{ badges?: { tasks?: number, reports?: number, alerts?: number } }} props
 */
export default function Sidebar({ badges = {} }) {
  const { user } = useAuth()
  const role = user?.role
  const location = useLocation()
  const [lastCardsUrl, setLastCardsUrl] = useState('/cards')

  useEffect(() => {
    if (isInCardsSection(location.pathname) && location.pathname !== lastCardsUrl) {
      setLastCardsUrl(location.pathname)
    }
  }, [location.pathname, lastCardsUrl])

  function isItemActive(itemTo) {
    if (itemTo === '/cards') return isInCardsSection(location.pathname)
    return location.pathname === itemTo
  }

  // Click on כרטסות from outside the section → restore last URL (e.g. /cards/42).
  // Click from inside the section → just go to the list (/cards), giving the
  // user a predictable "back to the list" affordance.
  function getLinkTo(itemTo) {
    if (itemTo === '/cards') {
      return isInCardsSection(location.pathname) ? '/cards' : lastCardsUrl
    }
    return itemTo
  }

  return (
    <aside className="sidebar">
      {SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.roles || item.roles.includes(role)
        )
        if (visibleItems.length === 0) return null
        return (
          <div className="sidebar-section" key={section.label}>
            <div className="sidebar-label">{section.label}</div>
            {visibleItems.map((item) => {
              const badgeVal = item.badgeKey ? badges[item.badgeKey] : null
              const isActive = isItemActive(item.to)
              const linkTo = getLinkTo(item.to)
              return (
                <Link
                  key={item.to}
                  to={linkTo}
                  className={'nav-btn' + (isActive ? ' active' : '')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {badgeVal > 0 && <span className="badge">{badgeVal}</span>}
                </Link>
              )
            })}
          </div>
        )
      })}
    </aside>
  )
}
