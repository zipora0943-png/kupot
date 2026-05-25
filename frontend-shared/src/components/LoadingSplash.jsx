import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataStoreReady } from '../context/DataStoreContext'

// Full-screen splash shown while the DataStore is hydrating (after login,
// before /api/initial-load + all resource fetches settle). Returns `children`
// once the store is ready, so callers can wrap the whole app:
//
//   <LoadingSplash>
//     <App />
//   </LoadingSplash>
//
// Skipped on the login screen (the user isn't authenticated yet, so no fetch).
export default function LoadingSplash({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const storeReady = useDataStoreReady()

  // Show splash while: auth is restoring from storage, OR user is logged-in
  // but the initial data load hasn't finished yet.
  const showSplash = authLoading || (isAuthenticated && !storeReady)

  if (!showSplash) return children

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
        gap: 24,
        background: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 56,
          border: '4px solid #cbd5e1',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'kupot-splash-spin 0.9s linear infinite',
        }}
      />
      <div style={{ fontSize: 16, fontWeight: 500 }}>
        טוען נתונים…
      </div>
      <style>{`
        @keyframes kupot-splash-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
