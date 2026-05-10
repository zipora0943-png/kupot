import React, { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@shared/context/AuthContext'
import { defaultPathForRole } from '../utils/defaultPath'

export default function LoginPage() {
  const { login, isAuthenticated, loading: authLoading, user: currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  // If already logged in, bounce to home (role-aware default)
  if (!authLoading && isAuthenticated) {
    const dest = location.state?.from?.pathname || defaultPathForRole(currentUser?.role)
    return <Navigate to={dest} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrMsg(null)
    if (!username || !password) {
      setErrMsg('שם משתמש וסיסמה נדרשים')
      return
    }
    setSubmitting(true)
    try {
      const user = await login(username.trim(), password)
      const dest = location.state?.from?.pathname || defaultPathForRole(user?.role)
      navigate(dest, { replace: true })
    } catch (err) {
      setErrMsg(err.message || 'שגיאת התחברות')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">📦 פרויקט קופות</div>
        <div className="login-subtitle">ממשק מנהל</div>

        {errMsg && <div className="alert red">{errMsg}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>שם משתמש</label>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              placeholder="admin"
            />
          </div>

          <div className="field">
            <label>סיסמה</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? 'מתחבר...' : 'התחברות'}
          </button>
        </form>

        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          דמו: <code>admin / password123</code>
        </div>
      </div>
    </div>
  )
}
