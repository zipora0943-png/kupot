import React from 'react'

// Slim banner that surfaces a non-mandatory update offer. Renders above the
// top bar so it never overlaps the page body.
//
// Props:
//   latestVersion  string  — "1.0.2"
//   onUpdate       fn      — user accepted the update
//   onDismiss      fn      — user closed the banner (remembered per version)
export default function UpdateBanner({ latestVersion, onUpdate, onDismiss }) {
  return (
    <div className="update-banner">
      <span className="update-banner-text">
        🆕 גרסה חדשה זמינה — {latestVersion}
      </span>
      <div className="update-banner-actions">
        <button className="btn primary sm" onClick={onUpdate}>עדכן עכשיו</button>
        <button className="update-banner-close" onClick={onDismiss} aria-label="סגור">✕</button>
      </div>
    </div>
  )
}
