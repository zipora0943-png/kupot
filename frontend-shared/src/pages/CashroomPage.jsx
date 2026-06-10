import React, { useEffect, useMemo, useRef, useState } from 'react'
// `@app-api` resolves to the importing frontend's own src/api — both apps
// expose the same envelope routes.
import { envelopes as envelopesApi } from '@app-api/endpoints'
import { useData } from '@shared/context/DataStoreContext'
import CashroomModal from '@shared/components/CashroomModal'
import PaginatedTable from '@shared/utils/PaginatedTable'
import './CashroomPage.css'

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

// Phone-width → stacked cards; wider → admin tables. Renders only one tree so a
// long pending queue doesn't build a hidden DOM on the phone.
function useIsNarrow(maxWidth = 640) {
  const query = `(max-width: ${maxWidth}px)`
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mql = window.matchMedia(query)
    const onChange = (e) => setIsNarrow(e.matches)
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange) // older Safari
    setIsNarrow(mql.matches)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [query])
  return isNarrow
}

/**
 * Unified cashroom screen, shared by the admin panel and the collector app.
 * Same layout, data and behaviour in both; the collector additionally passes a
 * `renderScanExtra` render-prop to inject a camera-scan button (the admin omits
 * it). Lists come live from the DataStore over the socket; today's totals come
 * from the server (single source of truth).
 *
 * Props:
 *   renderScanExtra?: ({ performLookup, scanning }) => ReactNode
 *     Rendered inside the scan panel's action row, before the search button.
 */
export default function CashroomPage({ renderScanExtra = null }) {
  // Live slices from the DataStore: socket-driven refetch keeps them current
  // after every envelope create / amount-entry without the page doing anything.
  const { data: pendingData, loading: pendingLoading } = useData('pendingEnvelopes')
  const { data: recentData,  loading: recentLoading  } = useData('recentEnteredEnvelopes')
  const { data: todayData }  = useData('cashroomTodayTotal')

  const pending = useMemo(() => (Array.isArray(pendingData) ? pendingData : []), [pendingData])
  const recent  = useMemo(() => (Array.isArray(recentData)  ? recentData  : []), [recentData])
  const todayStats = {
    total: Number(todayData?.total) || 0,
    count: Number(todayData?.count) || 0,
  }

  const isNarrow = useIsNarrow()

  // barcode scan
  const [scanValue, setScanValue] = useState('')
  const [scanErr,   setScanErr]   = useState(null)
  const [scanning,  setScanning]  = useState(false)
  const scanRef = useRef(null)

  // modal
  const [openEnv, setOpenEnv] = useState(null)

  // re-focus the scan input whenever the modal closes
  useEffect(() => {
    if (!openEnv) scanRef.current?.focus()
  }, [openEnv])

  // Auto-open the envelope as soon as the typed value is unambiguously a full
  // envelope number — i.e. no longer number shares it as a prefix. While the
  // value could still be extended (e.g. "19604" when "196049" exists) we wait.
  // The latest-request guard discards stale responses if the user keeps typing
  // after a request was already in flight.
  const lookupSeqRef = useRef(0)
  useEffect(() => {
    const value = scanValue.trim()
    if (!value || scanning || openEnv) return
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
  }, [scanValue, scanning, openEnv])

  // The store refetches the affected slices automatically when the backend
  // emits an envelope-changed event. Just close the modal.
  function handleEnvSaved() { /* store refreshes via socket */ }

  async function performLookup(num) {
    const value = String(num || '').trim()
    if (!value) return
    setScanErr(null)
    setScanning(true)
    let opened = false
    try {
      const env = await envelopesApi.byNumber(value)
      if (!env) {
        setScanErr(`מעטפה ${value} לא נמצאה`)
        setScanValue('')
        return
      }
      setOpenEnv(env)
      opened = true
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
      // Unless the modal opened, return focus to the scan field so the next
      // scan starts immediately without a click. Deferred so it runs after the
      // input is re-enabled (it's disabled while scanning).
      if (!opened) setTimeout(() => scanRef.current?.focus(), 0)
    }
  }

  async function handleScan(e) {
    e?.preventDefault?.()
    await performLookup(scanValue)
  }

  return (
    <div className="screen cashroom-page">
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
          <div className="val">{todayStats.count}</div>
          <div className="lbl">הוזנו היום</div>
        </div>
        <div className="stat-card">
          <div className="val">{formatMoney(todayStats.total) || '₪0'}</div>
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
              inputMode="numeric"
              placeholder="סרוק או הקלד מספר מעטפה"
              value={scanValue}
              onChange={(e) => { setScanValue(e.target.value); setScanErr(null) }}
              disabled={scanning}
              style={{ fontSize: 18, padding: 12, fontWeight: 600 }}
            />
          </div>
          {renderScanExtra && renderScanExtra({ performLookup, scanning })}
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

        {pendingLoading ? (
          <div className="loading"><div className="spinner" /><span>טוען מעטפות...</span></div>
        ) : pending.length === 0 ? (
          <div className="empty">אין מעטפות ממתינות 🎉</div>
        ) : isNarrow ? (
          <div className="cashroom-list">
            {pending.map((e) => (
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
        ) : (
          <PaginatedTable
            data={pending}
            getRowKey={(e) => e.id}
            header={(
              <tr>
                <th>תאריך גביה</th>
                <th>מס' מעטפה</th>
                <th>קופה</th>
                <th>עיר</th>
                <th>גובה</th>
                <th>פעולה</th>
              </tr>
            )}
            renderRow={(e) => (
              <>
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
              </>
            )}
          />
        )}
      </div>

      {/* RECENT ENTERED ENVELOPES */}
      <div className="panel">
        <div className="actions" style={{ marginBottom: 12 }}>
          <div className="page-title" style={{ fontSize: 16 }}>מעטפות אחרונות שהוזנו</div>
          <div style={{ marginRight: 'auto', fontSize: 12, color: 'var(--text3)' }}>
            ניתן לתקן רק מעטפות שהוזנו היום
          </div>
        </div>

        {recentLoading ? (
          <div className="loading"><div className="spinner" /><span>טוען מעטפות אחרונות...</span></div>
        ) : recent.length === 0 ? (
          <div className="empty">עדיין לא הוזנו מעטפות</div>
        ) : isNarrow ? (
          <div className="cashroom-list">
            {recent.map((e) => {
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
        ) : (
          <PaginatedTable
            data={recent}
            getRowKey={(e) => e.id}
            header={(
              <tr>
                <th>תאריך הזנה</th>
                <th>מס' מעטפה</th>
                <th>קופה</th>
                <th>עיר</th>
                <th>גובה</th>
                <th>סכום</th>
                <th>פעולה</th>
              </tr>
            )}
            renderRow={(e) => {
              const editable = isToday(e.entered_at)
              return (
                <>
                  <td>{formatDate(e.entered_at)}</td>
                  <td><strong>{e.envelope_number || '—'}</strong></td>
                  <td>{e.iron_number || '—'}</td>
                  <td>{e.city || '—'}</td>
                  <td>{e.collector_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td>{formatMoney(e.amount) || '—'}</td>
                  <td>
                    {editable ? (
                      <button
                        className="btn sm"
                        onClick={() => setOpenEnv(e)}
                      >✏️ ערוך סכום</button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                        לא ניתן לתיקון
                      </span>
                    )}
                  </td>
                </>
              )
            }}
          />
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
