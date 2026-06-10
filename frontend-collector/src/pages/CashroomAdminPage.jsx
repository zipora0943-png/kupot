import React, { useEffect, useMemo, useRef, useState } from 'react'
import { envelopes as envelopesApi } from '../api/endpoints'
import { useData } from '@shared/context/DataStoreContext'
import CashroomModal from '../components/CashroomModal'
import BarcodeScanner from '../components/BarcodeScanner'

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
  // Both lists come from the DataStore: socket-driven refetch keeps them
  // current after every envelope create / amount-entry without the page
  // having to do anything.
  const { data: pendingData, loading: pendingLoading } = useData('pendingEnvelopes')
  const { data: recentData,  loading: recentLoading  } = useData('recentEnteredEnvelopes')
  const pending = useMemo(() => (Array.isArray(pendingData) ? pendingData : []), [pendingData])
  const recent  = useMemo(() => (Array.isArray(recentData)  ? recentData  : []), [recentData])
  const errMsg    = null
  const recentErr = null

  const [scanValue, setScanValue] = useState('')
  const [scanErr,   setScanErr]   = useState(null)
  const [scanning,  setScanning]  = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const scanRef = useRef(null)

  const [openEnv, setOpenEnv] = useState(null)

  // "Entered today" stats are derived from the live recent list: any envelope
  // there with status='entered' + today's entered_at counts.
  const enteredToday = useMemo(
    () => recent.filter((e) => e.status === 'entered' && isToday(e.entered_at)),
    [recent],
  )

  useEffect(() => {
    if (!openEnv && !cameraOpen) scanRef.current?.focus()
  }, [openEnv, cameraOpen])

  // Auto-open the envelope as soon as the typed value is unambiguously a full
  // envelope number — i.e. no longer number shares it as a prefix. While the
  // value could still be extended (e.g. "19604" when "196049" exists) we wait.
  // The latest-request guard discards stale responses if the user keeps typing
  // after a request was already in flight.
  const lookupSeqRef = useRef(0)
  useEffect(() => {
    const value = scanValue.trim()
    if (!value || scanning || openEnv || cameraOpen) return
    const mySeq = ++lookupSeqRef.current
    const timer = setTimeout(async () => {
      try {
        const res = await envelopesApi.prefixUnique(value)
        if (mySeq !== lookupSeqRef.current) return // user kept typing
        if (res?.unique && res.envelope) {
          setOpenEnv(res.envelope)
          setScanValue('')
        }
      } catch {
        // Silent: the user can still press Enter / החיפוש button.
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [scanValue, scanning, openEnv, cameraOpen])

  // The store refetches the affected slices automatically when the backend
  // emits an envelope-changed event. Just close the modal.
  function handleEnvSaved() { /* store refreshes via socket */ }

  async function performLookup(num) {
    const value = String(num || '').trim()
    if (!value) return
    setScanErr(null)
    setScanning(true)
    try {
      const env = await envelopesApi.byNumber(value)
      if (!env) {
        setScanErr(`מעטפה ${value} לא נמצאה`)
        setScanValue('')
        return
      }
      setOpenEnv(env)
      setScanValue('')
    } catch (err) {
      // A real "not found" arrives as a 404 — show a Hebrew message and clear
      // the field so the next scan starts clean. Network / other errors keep
      // the typed value so the user can retry without re-typing.
      if (err.status === 404) {
        setScanErr(`מעטפה ${value} לא נמצאה`)
        setScanValue('')
      } else {
        setScanErr(err.message || `מעטפה ${value} לא נמצאה`)
      }
    } finally {
      setScanning(false)
    }
  }

  async function handleScan(e) {
    e?.preventDefault?.()
    await performLookup(scanValue)
  }

  function handleCameraScan(value) {
    setCameraOpen(false)
    performLookup(value)
  }

  const totalToday = useMemo(
    () => enteredToday.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [enteredToday]
  )

  return (
    <div className="screen cashroom-screen">
      <div className="page-header">
        <div>
          <div className="page-title">חדר כסף</div>
          <div className="page-subtitle">סריקת ברקוד והזנת סכומים למעטפות ממתינות</div>
        </div>
      </div>

      <div className="stats-row stats-3 cashroom-stats">
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

      <div className="panel">
        <div className="page-title" style={{ fontSize: 16, marginBottom: 8 }}>סריקת מעטפה</div>
        <form onSubmit={handleScan} className="cashroom-scan-form">
          <input
            ref={scanRef}
            autoFocus
            placeholder="סרוק או הקלד מספר מעטפה"
            value={scanValue}
            onChange={(e) => { setScanValue(e.target.value); setScanErr(null) }}
            disabled={scanning}
            inputMode="numeric"
            className="cashroom-scan-input"
          />
          <div className="cashroom-scan-actions">
            <button
              type="button"
              className="btn cashroom-camera-btn"
              onClick={() => setCameraOpen(true)}
              disabled={scanning}
              aria-label="פתח מצלמה לסריקה"
            >
              📷 <span>סריקת מצלמה</span>
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={scanning || !scanValue.trim()}
            >{scanning ? 'מחפש...' : 'חיפוש'}</button>
          </div>
        </form>
        {scanErr && <div className="alert red" style={{ marginTop: 10 }}>{scanErr}</div>}
      </div>

      <div className="panel">
        <div className="actions" style={{ marginBottom: 12 }}>
          <div className="page-title" style={{ fontSize: 16 }}>תור מעטפות ממתינות</div>
          <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text2)' }}>
            סה"כ: <strong style={{ color: 'var(--text)' }}>{pending.length}</strong>
          </div>
        </div>

        {errMsg && <div className="alert red">{errMsg}</div>}

        {pendingLoading ? (
          <div className="loading"><div className="spinner" /><span>טוען מעטפות...</span></div>
        ) : pending.length === 0 ? (
          <div className="empty">אין מעטפות ממתינות 🎉</div>
        ) : (
          <div className="cashroom-list">
            {pending.map(e => (
              <button
                key={e.id}
                type="button"
                className="cashroom-row pending"
                onClick={() => setOpenEnv(e)}
              >
                <div className="cashroom-row-main">
                  <div className="cashroom-row-title">
                    מעטפה <strong>#{e.envelope_number || '—'}</strong>
                  </div>
                  <div className="cashroom-row-meta">
                    {[
                      e.iron_number ? `קופה ${e.iron_number}` : null,
                      e.city,
                      formatDate(e.collected_at),
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {e.collector_name && (
                    <div className="cashroom-row-meta">גובה: {e.collector_name}</div>
                  )}
                </div>
                <span className="cashroom-row-cta">הזנת סכום ‹</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="actions" style={{ marginBottom: 12 }}>
          <div className="page-title" style={{ fontSize: 16 }}>מעטפות אחרונות שהוזנו</div>
          <div style={{ marginRight: 'auto', fontSize: 12, color: 'var(--text3)' }}>
            ניתן לתקן רק מעטפות שהוזנו היום
          </div>
        </div>

        {recentErr && <div className="alert red">{recentErr}</div>}

        {recentLoading ? (
          <div className="loading"><div className="spinner" /><span>טוען מעטפות אחרונות...</span></div>
        ) : recent.length === 0 ? (
          <div className="empty">עדיין לא הוזנו מעטפות</div>
        ) : (
          <div className="cashroom-list">
            {recent.map(e => {
              const editable = isToday(e.entered_at)
              const amount = formatMoney(e.amount)
              const Tag = editable ? 'button' : 'div'
              return (
                <Tag
                  key={e.id}
                  type={editable ? 'button' : undefined}
                  className={`cashroom-row entered${editable ? '' : ' locked'}`}
                  onClick={editable ? () => setOpenEnv(e) : undefined}
                >
                  <div className="cashroom-row-main">
                    <div className="cashroom-row-title">
                      מעטפה <strong>#{e.envelope_number || '—'}</strong>
                      {amount && <span className="cashroom-row-amount">{amount}</span>}
                    </div>
                    <div className="cashroom-row-meta">
                      {[
                        e.iron_number ? `קופה ${e.iron_number}` : null,
                        e.city,
                        formatDate(e.entered_at),
                      ].filter(Boolean).join(' · ')}
                    </div>
                    {e.collector_name && (
                      <div className="cashroom-row-meta">גובה: {e.collector_name}</div>
                    )}
                  </div>
                  <span className="cashroom-row-cta">
                    {editable ? '✏️ ערוך ‹' : 'נעול'}
                  </span>
                </Tag>
              )
            })}
          </div>
        )}
      </div>

      <CashroomModal
        open={!!openEnv}
        envelope={openEnv}
        onClose={() => setOpenEnv(null)}
        onSaved={handleEnvSaved}
      />

      {cameraOpen && (
        <BarcodeScanner
          onScan={handleCameraScan}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  )
}
