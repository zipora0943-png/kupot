import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps protected pages. Behavior:
 *  - while AuthContext is loading → render a spinner
 *  - if not authenticated → redirect to /login (remembering where we came from)
 *  - otherwise → render children
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>טוען...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
