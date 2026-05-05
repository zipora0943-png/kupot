import React, { useEffect, useMemo, useRef, useState } from 'react'
import { envelopes as envelopesApi } from '../api/endpoints'
import CashroomModal from '../components/CashroomModal'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return null
  const num = Number(n)
  if (!Number.isFinite(num)) return null
  return '₪' + num.toLocaleString('he-IL')
}

function isToday(iso) {
  if (!iso) return false
  const d = new Date(iso)
  if (isNaN(d)) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate()
}

export default function CashroomAdminPage() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [errMsg,  setErrMsg]  = useState(null)

  // barcode scan
  const [scanValue, setScanValue] = useState('')
  const [scanErr,   setScanErr]   = useState(null)
  const [scanning,  setScanning]  = useState(false)
  const scanRef = useRef(null)

  // modal
  const [openEnv, setOpenEnv] = useState(null)

  // track today's entered envelopes (since this page started) — survives backend pending filter
  const [enteredToday, setEnteredToday] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrMsg(null)
      try {
        const data = await envelopesApi.getPending()
        if (!cancelled) setPending(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת מעטפות ממתינות')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // re-focus the scan input whenever the modal closes
  useEffect(() => {
    if (!openEnv) scanRef.current?.focus()
  }, [openEnv])

  function handleEnvSaved(updated) {
    if (!updated) return
    // remove from pending list
    setPending(prev => prev.filter(e => e.id !== updated.id))
    // record for today's stat (only if entered today)
    if (updated.status === 'entered' && isToday(updated.entered_at || new Date().toISOString())) {
      setEnteredToday(prev => {
        if (prev.some(e => e.id === updated.id)) return prev
        return [...prev, updated]
      })
    }
  }

  async function handleScan(e) {
    e?.preventDefault?.()
    const num = scanValue.trim()
    if (!num) return
    setScanErr(null)
    setScanning(true)
    try {
      const env = await envelopesApi.byNumber(num)
      if (!env) {
        setScanErr(`מעטפה ${num} לא נמצאה`)
        return
      }
      setOpenEnv(env)
      setScanValue('')
    } catch (err) {
      setScanErr(err.message || `מעטפה ${num} לא נמצאה`)
    } finally {
      setScanning(false)
    }
  }

  const totalToday = useMemo(
    () => enteredToday.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [enteredToday]
  )

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">חדר כסף</div>
          <div className="page-subtitle">סריקת ברקוד והזנת סכומים למעטפות ממתינות</div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row stats-3">
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--yellow)' }}>{pending.length}</div>
          <div className="lbl">ממתינות להזנה</div>
        </div>
        <div className="stat-card">
          <div className="val">{enteredToday.length}</div>
          <div className="lbl">הוזנו היום</div>
        </div>
        <div className="stat-card">
          <div className="val">{formatMoney(totalToday) || '₪0'}</div>
          <div className="lbl">סה"כ הוזן היום</div>
        </div>
      </div>

      {/* SCAN PANEL */}
      <div className="panel">
        <div className="page-title" style={{ fontSize: 16, marginBottom: 8 }}>סריקת מעטפה</div>
        <form onSubmit={handleScan} className="filters-row" style={{ alignItems: 'flex-end' }}>
          <div className="field grow">
            <label>מספר מעטפה (ברקוד)</label>
            <input
              ref={scanRef}
              autoFocus
              placeholder="סרוק או הקלד מספר מעטפה ולחץ Enter"
              value={scanValue}
              onChange={(e) => { setScanValue(e.target.value); setScanErr(null) }}
              disabled={scanning}
              style={{ fontSize: 18, padding: 12, fontWeight: 600 }}
            />
          </div>
          <button
            type="submit"
            className="btn primary"
            disabled={scanning || !scanValue.trim()}
          >{scanning ? 'מחפש...' : 'חיפוש'}</button>
        </form>
        {scanErr && <div className="alert red" style={{ marginTop: 10 }}>{scanErr}</div>}
      </div>

      {/* PENDING QUEUE */}
      <div className="panel">
        <div className="actions" style={{ marginBottom: 12 }}>
          <div className="page-title" style={{ fontSize: 16 }}>תור מעטפות ממתינות</div>
          <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text2)' }}>
            סה"כ: <strong style={{ color: 'var(--text)' }}>{pending.length}</strong>
          </div>
        </div>

        {errMsg && <div className="alert red">{errMsg}</div>}

        {loading ? (
          <div className="loading"><div className="spinner" /><span>טוען מעטפות...</span></div>
        ) : pending.length === 0 ? (
          <div className="empty">אין מעטפות ממתינות 🎉</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>תאריך גביה</th>
                  <th>מס' מעטפה</th>
                  <th>קופה</th>
                  <th>עיר</th>
                  <th>גובה</th>
                  <th>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(e => (
                  <tr key={e.id}>
                    <td>{formatDate(e.collected_at)}</td>
                    <td><strong>{e.envelope_number || '—'}</strong></td>
                    <td>{e.iron_number || '—'}</td>
                    <td>{e.city || '—'}</td>
                    <td>{e.collector_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td>
                      <button
                        className="btn sm primary"
                        onClick={() => setOpenEnv(e)}
                      >הזנת סכום</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CashroomModal
        open={!!openEnv}
        envelope={openEnv}
        onClose={() => setOpenEnv(null)}
        onSaved={handleEnvSaved}
      />
    </div>
  )
}
