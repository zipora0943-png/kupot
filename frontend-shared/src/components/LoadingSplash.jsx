import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataStoreReady, useDataStoreProgress } from '../context/DataStoreContext'

// Full-screen splash shown while the DataStore is hydrating (after login,
// before /api/initial-load + all resource fetches settle). Returns `children`
// once the store is ready, so callers can wrap the whole app:
//
//   <LoadingSplash>
//     <App />
//   </LoadingSplash>
//
// While loading, renders a progress bar that fills as each resource resolves,
// plus a labelled list of items with ✓ / ⏳ / ✕ next to each.
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
        gap: 18,
        padding: '24px',
        background: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
        direction: 'rtl',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600 }}>טוען נתונים…</div>

      <div style={{ width: 'min(360px, 80vw)' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            width: '100%',
            height: 10,
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
              background: '#2563eb',
              borderRadius: 999,
              transition: 'width 250ms ease-out',
            }}
          />
        </div>
        <div style={{
          marginTop: 6,
          fontSize: 13,
          color: '#475569',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>{loaded}/{total}</span>
          <span>{pct}%</span>
        </div>
      </div>

      {items.length > 0 && (
        <ul style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          width: 'min(360px, 80vw)',
          fontSize: 13,
          color: '#334155',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px 12px',
        }}>
          {items.map((it) => (
            <li key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block',
                width: 14,
                textAlign: 'center',
                color: it.status === 'loaded' ? '#16a34a'
                     : it.status === 'error'  ? '#dc2626'
                     :                          '#94a3b8',
              }}>
                {it.status === 'loaded' ? '✓'
                 : it.status === 'error'  ? '✕'
                 :                          '⏳'}
              </span>
              <span style={{
                opacity: it.status === 'pending' ? 0.7 : 1,
                textDecoration: it.status === 'error' ? 'line-through' : 'none',
              }}>{it.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
