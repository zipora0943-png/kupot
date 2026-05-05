import React from 'react'

/**
 * Temporary placeholder shown for pages that haven't been built yet.
 * Replace each one with a real page as we go.
 */
export default function PlaceholderPage({ title, subtitle }) {
  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="panel">
        <div className="empty">דף זה עדיין בבנייה 🚧</div>
      </div>
    </div>
  )
}
