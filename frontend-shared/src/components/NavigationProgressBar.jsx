import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// Top-of-screen progress bar that appears briefly on every route change.
// Useful when the destination page is heavy (thousands of rows) and React
// is doing CPU-bound rendering — the user sees visual feedback instead of a
// frozen UI.
//
// Mechanics:
//   - On every location.pathname change → start a new "run"
//   - Animate width from 0 → 80% over ~500ms (the "looks like it's loading" feel)
//   - After 600ms total → snap to 100% and fade out
//   - Hidden when not running
//
// We can't tell when the heavy render is "done" (browser layout/paint is not
// observable from JS), so we just give the user a fixed-duration visual cue
// matching the typical worst case.
export default function NavigationProgressBar({
  color = '#4338ca',
  height = 3,
}) {
  const location = useLocation()
  const [phase, setPhase] = useState('idle') // 'idle' | 'running' | 'finishing'
  const firstRenderRef = useRef(true)

  useEffect(() => {
    // Skip the very first render — we don't want a bar on initial app load
    // (the LoadingSplash already covers that case).
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }

    setPhase('running')
    const finishTimer = setTimeout(() => setPhase('finishing'), 500)
    const hideTimer   = setTimeout(() => setPhase('idle'), 800)
    return () => {
      clearTimeout(finishTimer)
      clearTimeout(hideTimer)
    }
  }, [location.pathname])

  const visible = phase !== 'idle'
  const width   = phase === 'running' ? '80%' : phase === 'finishing' ? '100%' : '0%'

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: 0,
        height,
        zIndex: 10000,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 250ms ease',
      }}
    >
      <div style={{
        height: '100%',
        width,
        background: `linear-gradient(90deg, ${color} 0%, #6366f1 50%, #818cf8 100%)`,
        boxShadow: `0 0 8px ${color}`,
        transition: phase === 'running'
          ? 'width 500ms cubic-bezier(0.1, 0.7, 0.1, 1)'
          : 'width 200ms ease-out',
      }} />
    </div>
  )
}
