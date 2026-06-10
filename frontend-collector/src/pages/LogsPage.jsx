import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@shared/context/AuthContext'
import { api } from '@shared/api/client'

// Admin-only viewer for client-log batches uploaded by collectors.
// Pulls from the in-memory ring buffer on the server (POST/GET /api/client-logs).
// Auto-refreshes every 5 s while open so a phone that crashed and just
// reconnected shows up live.

export default function LogsPage() {
  const { user, isAuthenticated } = useAuth()
  const [entries, setEntries] = useState([])
  const [total,   setTotal]   = useState(0)
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [userFilter,  setUserFilter]  = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/client-logs')
      setEntries(Array.isArray(data?.entries) ? data.entries : [])
      setTotal(Number(data?.total) || 0)
    } catch (e) {
      setError(e?.message || 'שגיאה בטעינת הלוג')
    } finally {
      setLoading(false)
    }
  }, [])

  async function clearAll() {
    if (!confirm('למחוק את כל הלוגים בשרת? פעולה זו אינה הפיכה.')) return
    try {
      await api.delete('/client-logs')
      setEntries([])
      setTotal(0)
    } catch (e) {
      setError(e?.message || 'שגיאה במחיקה')
    }
  }

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [autoRefresh, load])

  const allUsers = useMemo(() => {
    const set = new Map()
    for (const e of entries) {
      if (e.user_id != null) {
        const label = `${e.username || '?'} (${e.user_id})`
        set.set(e.user_id, label)
      }
    }
    return Array.from(set.entries())
  }, [entries])

  const visible = useMemo(() => {
    if (userFilter === 'all') return entries
    const uid = Number(userFilter)
    return entries.filter((e) => e.user_id === uid)
  }, [entries, userFilter])

  function copyAll() {
    const text = visible.flatMap((e) => [
      `=== ${e.received_at} | user:${e.username || '?'}(${e.user_id}) role:${e.role} ===`,
      e.device_info ? `UA: ${e.device_info}` : null,
      ...e.lines,
      '',
    ]).filter(Boolean).join('\n')
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h2>לוג מערכת</h2>
        <p>יש להתחבר כמנהל כדי לצפות בלוגים.</p>
        <a href="/login" className="btn primary">להתחברות</a>
      </div>
    )
  }
  if (user?.role !== 'admin') {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h2>לוג מערכת</h2>
        <p className="alert red">צפייה בלוגים זמינה למנהל בלבד.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, gap: 8, flexWrap: 'wrap',
      }}>
        <h2 style={{ margin: 0 }}>📋 לוג מערכת ({total} מנות)</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn sm" onClick={load} disabled={loading}>
            {loading ? 'טוען...' : '🔄 רענן'}
          </button>
          <button type="button" className="btn sm" onClick={copyAll}>📋 העתק</button>
          <button type="button" className="btn sm danger" onClick={clearAll}>🗑️ נקה</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            /> auto 5s
          </label>
        </div>
      </div>

      {allUsers.length > 1 && (
        <div style={{ marginBottom: 8 }}>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            style={{ width: '100%', padding: 6 }}
          >
            <option value="all">כל המשתמשים ({entries.length} מנות)</option>
            {allUsers.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="alert red" style={{ marginBottom: 8 }}>{error}</div>}

      {visible.length === 0 && !loading && (
        <div className="empty">אין לוגים להציג</div>
      )}

      <div style={{
        background: '#0f172a', color: '#9ae6b4',
        padding: 10, borderRadius: 8,
        fontFamily: 'monospace', fontSize: 11, lineHeight: 1.45,
        direction: 'ltr', textAlign: 'left',
        maxHeight: '70vh', overflowY: 'auto',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {visible.map((e, idx) => (
          <div key={idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed #334155' }}>
            <div style={{ color: '#fbbf24', marginBottom: 2 }}>
              === {e.received_at} | {e.username || '?'} (id {e.user_id}) | {e.role} ===
            </div>
            {e.device_info && (
              <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 2 }}>UA: {e.device_info}</div>
            )}
            {e.lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        ))}
      </div>
    </div>
  )
}
