import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// Top-of-screen progress bar that appears on every route change. Designed to
// be unmistakably visible: 4px tall, vibrant indigo gradient with a glow,
// and an extended animation so the user actually has time to notice it.
//
// Mechanics:
//   - On every location.pathname change → start a new "run"
//   - Width animates 0 → 85% over ~700ms (gives the feel of real loading)
//   - At ~900ms total → snap to 100% then fade out
//
// We can't observe when the heavy paint finishes from JS, so the duration
// is fixed to roughly match a worst-case tab switch on a large dataset.
export default function NavigationProgressBar({
  color = '#4338ca',
  height = 4,
}) {
  const location = useLocation()
  const [phase, setPhase] = useState('idle') // 'idle' | 'running' | 'finishing'
  const firstRenderRef = useRef(true)

  useEffect(() => {
    // Skip the very first render — the LoadingSplash already covers initial
    // load, no need for a top-bar there too.
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }

    setPhase('running')
    const finishTimer = setTimeout(() => setPhase('finishing'), 700)
    const hideTimer   = setTimeout(() => setPhase('idle'), 1100)
    return () => {
      clearTimeout(finishTimer)
      clearTimeout(hideTimer)
    }
  }, [location.pathname])

  const visible = phase !== 'idle'
  const width   = phase === 'running' ? '85%' : phase === 'finishing' ? '100%' : '0%'

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: 0,
        height,
        zIndex: 10001,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 350ms ease',
        background: 'rgba(67, 56, 202, 0.08)',
      }}
    >
      <div style={{
        height: '100%',
        width,
        background: `linear-gradient(90deg, ${color} 0%, #6366f1 50%, #8b5cf6 100%)`,
        boxShadow: `0 0 12px ${color}, 0 2px 8px rgba(99, 102, 241, 0.5)`,
        transition: phase === 'running'
          ? 'width 700ms cubic-bezier(0.1, 0.7, 0.1, 1)'
          : 'width 200ms ease-out',
      }} />
    </div>
  )
}
