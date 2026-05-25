import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataStoreReady, useDataStoreProgress } from '../context/DataStoreContext'

// Full-screen splash shown while the DataStore is hydrating. Returns
// `children` once the store is ready. Visual style matches the admin design
// tokens (indigo accent #4338ca, slate text). The progress bar fills as
// resources resolve; the item list shows ✓ / ⏳ / ✕ per slice.
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'radial-gradient(120% 80% at 50% 0%, #eef2ff 0%, #f4f7fa 55%, #f8fafc 100%)',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          width: 'min(440px, 92vw)',
          background: '#ffffff',
          borderRadius: 18,
          padding: '32px 28px 28px',
          boxShadow: '0 12px 40px -8px rgba(67, 56, 202, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.06)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Animated brand mark */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              color: '#fff',
              boxShadow: '0 8px 24px -6px rgba(67, 56, 202, 0.45)',
              animation: 'kupot-splash-pulse 1.8s ease-in-out infinite',
            }}
          >
            💰
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: 6,
        }}>
          טעינת המערכת
        </div>
        <div style={{
          textAlign: 'center',
          fontSize: 13,
          color: '#64748b',
          marginBottom: 22,
        }}>
          מסנכרן את כל הנתונים — זה ייקח רגע אחד בלבד
        </div>

        {/* Progress bar with shimmer */}
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            width: '100%',
            height: 8,
            background: '#e2e8f0',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)',
              borderRadius: 999,
              transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)',
            }}
          />
          {/* Shimmer effect over the filled portion */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
              backgroundSize: '200% 100%',
              animation: 'kupot-splash-shimmer 1.6s linear infinite',
            }}
          />
        </div>

        <div style={{
          marginTop: 10,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 13,
          fontWeight: 600,
          color: '#475569',
        }}>
          <span>{loaded} / {total}</span>
          <span style={{ color: '#4338ca' }}>{pct}%</span>
        </div>

        {items.length > 0 && (
          <ul style={{
            marginTop: 18,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 16px',
            fontSize: 13,
          }}>
            {items.map((it) => {
              const isLoaded = it.status === 'loaded'
              const isError  = it.status === 'error'
              return (
                <li
                  key={it.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    transition: 'opacity 200ms',
                    opacity: isLoaded || isError ? 1 : 0.6,
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: isLoaded ? '#dcfce7' : isError ? '#fee2e2' : '#e2e8f0',
                    color:      isLoaded ? '#16a34a' : isError ? '#dc2626' : '#94a3b8',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'all 200ms',
                  }}>
                    {isLoaded ? '✓' : isError ? '✕' : '·'}
                  </span>
                  <span style={{
                    color: isError ? '#dc2626' : '#334155',
                    fontWeight: isLoaded ? 600 : 500,
                  }}>{it.label}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <style>{`
        @keyframes kupot-splash-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 24px -6px rgba(67, 56, 202, 0.45); }
          50%      { transform: scale(1.06); box-shadow: 0 12px 32px -4px rgba(67, 56, 202, 0.55); }
        }
        @keyframes kupot-splash-shimmer {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
