import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@shared/context/AuthContext'
import { API_BASE } from '@shared/api/client'
import { defaultPathForRole } from '../utils/defaultPath'
import { isNativeAndroid } from '../utils/apkInstaller'

// Strip the trailing /api so we can build absolute URLs from server-relative
// paths the API returns (e.g. apk_url: "/downloads/foo.apk").
const STATIC_BASE = API_BASE.replace(/\/api\/?$/, '')

export default function LoginPage() {
  const { login, user, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)
  // Latest APK manifest — sourced from /api/version/collector (same manifest
  // the in-app update flow uses) so the download link auto-tracks every release
  // without a separate file to maintain. Best-effort: if it fails the section
  // just doesn't render.
  const [appInfo, setAppInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${STATIC_BASE}/api/version/collector`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setAppInfo(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!authLoading && isAuthenticated) {
    // Cashroom users always go straight to the cashroom screen — even if they
    // were redirected here from a different deep-link, RoleGuard would bounce
    // them right back. Skip the round-trip.
    const dest = user?.role === 'cashroom'
      ? defaultPathForRole(user.role)
      : (location.state?.from?.pathname || '/boxes')
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
      const loggedIn = await login(username.trim(), password)
      const dest = loggedIn?.role === 'cashroom'
        ? defaultPathForRole(loggedIn.role)
        : (location.state?.from?.pathname || '/boxes')
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

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <a
            href="/logs"
            style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'underline' }}
          >📋 צפה בלוג מערכת (מנהל)</a>
        </div>

        {appInfo && appInfo.apk_url && isNativeAndroid() && (
          <div className="apk-download" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <a
              href={`${STATIC_BASE}${appInfo.apk_url}`}
              download={appInfo.apk_url.split('/').pop()}
              className="btn"
              style={{ display: 'inline-block', textDecoration: 'none' }}
            >
              📥 הורד גירסה אחרונה ({appInfo.version})
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
