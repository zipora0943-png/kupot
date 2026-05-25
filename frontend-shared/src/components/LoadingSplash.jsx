import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataStoreReady, useDataStoreProgress } from '../context/DataStoreContext'

// Gmail-style loading splash: clean white background, large centered logo
// mark with breathing animation, prominent multi-color progress bar across
// the middle of the viewport, minimal text. Renders `children` once the
// DataStore is ready.
export default function LoadingSplash({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const storeReady = useDataStoreReady()
  const progress = useDataStoreProgress()

  const showSplash = authLoading || (isAuthenticated && !storeReady)
  if (!showSplash) return children

  const total  = progress?.total  || 0
  const loaded = progress?.loaded || 0
  const pct    = total ? Math.round((loaded / total) * 100) : 0
  const items  = progress?.items  || []

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
        padding: '24px',
        background: '#ffffff',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#1f2937',
        direction: 'rtl',
      }}
    >
      {/* Animated brand mark — rotating gradient ring around the logo, like
          Gmail's "M" spinner. The gradient sweeps continuously. */}
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 112,
          height: 112,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #4338ca, #6366f1, #8b5cf6, #ec4899, #4338ca)',
          animation: 'kupot-splash-spin 2s linear infinite',
          maskImage: 'radial-gradient(circle, transparent 50%, black 53%)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 50%, black 53%)',
        }} />
        <div style={{
          position: 'absolute',
          inset: 8,
          borderRadius: '50%',
          background: '#ffffff',
        }} />
        <div style={{
          position: 'relative',
          fontSize: 44,
          lineHeight: 1,
          animation: 'kupot-splash-breathe 2.4s ease-in-out infinite',
        }}>
          💰
        </div>
      </div>

      {/* Title */}
      <div style={{
        textAlign: 'center',
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: '-0.01em',
      }}>
        קופות
        <div style={{
          marginTop: 4,
          fontSize: 14,
          fontWeight: 500,
          color: '#6b7280',
        }}>
          טוען את המערכת…
        </div>
      </div>

      {/* Wide progress bar — full focus of the screen, like Gmail's loader */}
      <div style={{ width: 'min(420px, 80vw)' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            width: '100%',
            height: 6,
            background: '#e5e7eb',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%)',
            borderRadius: 999,
            transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 14px rgba(99, 102, 241, 0.6)',
          }} />
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
            animation: 'kupot-splash-shimmer 1.4s linear infinite',
          }} />
        </div>

        <div style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 13,
          color: '#6b7280',
        }}>
          <span>{loaded} מתוך {total}</span>
          <span style={{ fontWeight: 700, color: '#4338ca' }}>{pct}%</span>
        </div>
      </div>

      {/* Subtle item list — softer than the previous design, more like a
          status line than a checklist. Wraps to multiple rows naturally. */}
      {items.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '6px 8px',
          maxWidth: 'min(520px, 90vw)',
        }}>
          {items.map((it) => {
            const isLoaded = it.status === 'loaded'
            const isError  = it.status === 'error'
            return (
              <span
                key={it.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  background:  isLoaded ? '#dcfce7' : isError ? '#fee2e2' : '#f3f4f6',
                  color:       isLoaded ? '#166534' : isError ? '#991b1b' : '#6b7280',
                  border: `1px solid ${
                    isLoaded ? '#bbf7d0' : isError ? '#fecaca' : '#e5e7eb'
                  }`,
                  transition: 'all 250ms',
                }}
              >
                <span style={{ fontSize: 10 }}>
                  {isLoaded ? '✓' : isError ? '✕' : '○'}
                </span>
                {it.label}
              </span>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes kupot-splash-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes kupot-splash-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes kupot-splash-shimmer {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
