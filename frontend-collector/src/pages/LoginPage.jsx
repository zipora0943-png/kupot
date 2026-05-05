import React, { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  if (!authLoading && isAuthenticated) {
    const dest = location.state?.from?.pathname || '/boxes'
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
      await login(username.trim(), password)
      const dest = location.state?.from?.pathname || '/boxes'
      navigate(dest, { replace: true })
    } catch (err) {
      setErrMsg(err.message || 'שגיאת התחברות')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page mobile">
      <div className="login-card">
        <div className="login-logo">📦 אפליקציית גובים</div>
        <div className="login-subtitle">כניסה לגובה</div>

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
              placeholder="שם משתמש"
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

          <button type="submit" className="btn primary login-submit" disabled={submitting}>
            {submitting ? 'מתחבר...' : 'התחברות'}
          </button>
        </form>
      </div>
    </div>
  )
}
