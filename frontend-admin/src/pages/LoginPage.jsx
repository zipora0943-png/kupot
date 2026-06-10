import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@shared/context/AuthContext'
import { API_BASE } from '@shared/api/client'
import { defaultPathForRole } from '../utils/defaultPath'

// Strip trailing /api so we can build absolute URLs from server-relative
// paths the version manifest returns (e.g. apk_url: "/downloads/foo.apk").
const STATIC_BASE = API_BASE.replace(/\/api\/?$/, '')

export default function LoginPage() {
  const { login, isAuthenticated, loading: authLoading, user: currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)
  // Latest collector APK manifest — same endpoint the collector login uses.
  // Lets the admin share/download the APK without leaving the panel.
  const [appInfo, setAppInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${STATIC_BASE}/api/version/collector`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setAppInfo(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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

        {appInfo && appInfo.apk_url && (
          <div className="apk-download" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <a
              href={`${STATIC_BASE}${appInfo.apk_url}`}
              download={appInfo.apk_url.split('/').pop()}
              className="btn"
              style={{ display: 'inline-block', textDecoration: 'none' }}
            >
              📥 הורד אפליקציית גובים ({appInfo.version})
            </a>
            {appInfo.release_notes && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, lineHeight: 1.4 }}>
                {appInfo.release_notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
