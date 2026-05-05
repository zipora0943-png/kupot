import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  alerts as alertsApi,
  reports as reportsApi,
  cards as cardsApi,
} from '../api/endpoints'
import { computeCardLabels } from '../utils/cardLabel'
import ReportModal from '../components/ReportModal'
import CloseReportModal from '../components/CloseReportModal'
import { useAuth } from '../context/AuthContext'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysSince(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [globalThreshold, setGlobalThreshold] = useState(30)
  const [items,           setItems]    = useState([])    // no-collection items
  const [openReports,     setOpenReports] = useState([])
  const [allCards,        setAllCards] = useState([])
  const [loading,         setLoading]  = useState(true)
  const [errMsg,          setErrMsg]   = useState(null)
  const [reloadCounter,   setReloadCounter] = useState(0)

  // modal
  const [openReport,  setOpenReport]  = useState(null)
  const [closeReport, setCloseReport] = useState(null)

  function handleReportSaved(updated) {
    if (!updated) return
    setOpenReports(prev => {
      // If the report was closed/converted, remove it from the "open" panel.
      if (updated.status && updated.status !== 'open') {
        return prev.filter(r => r.id !== updated.id)
      }
      return prev.map(r => r.id === updated.id ? { ...r, ...updated } : r)
    })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrMsg(null)
      try {
        const [nc, rep, c] = await Promise.all([
          alertsApi.noCollection(),
          reportsApi.getAll({ status: 'open' }).catch(() => []),
          cardsApi.getAll().catch(() => []),
        ])
        if (!cancelled) {
          setGlobalThreshold(nc?.global_threshold ?? 30)
          setItems(Array.isArray(nc?.items) ? nc.items : [])
          setOpenReports(Array.isArray(rep) ? rep : [])
          setAllCards(Array.isArray(c) ? c : [])
        }
      } catch (err) {
        if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת התראות')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [reloadCounter])

  const labels = useMemo(() => computeCardLabels(allCards), [allCards])

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">התראות</div>
          <div className="page-subtitle">קופות ללא גביה ודיווחים פתוחים</div>
        </div>
        <button
          className="btn"
          onClick={() => navigate('/settings')}
        >⚙️ הגדרות</button>
      </div>

      <div className="alert warn">
        ⚙️ הגדרה גלובלית: התראה על אי-גביה מעל <strong>{globalThreshold} ימים</strong>
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}

      {/* === Panel 1: cards without collection === */}
      <div className="panel">
        <div className="panel-title">קופות ללא גביה מעל הסף המוגדר</div>
        {loading ? (
          <div className="loading"><div className="spinner" /><span>טוען...</span></div>
        ) : items.length === 0 ? (
          <div className="empty">אין קופות שחורגות מהסף — הכל בסדר 🎉</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>קופה / שם</th>
                  <th>כרטסת</th>
                  <th>עיר</th>
                  <th>גובה</th>
                  <th>גביה אחרונה</th>
                  <th>ימים</th>
                  <th>סף התראה</th>
                  <th>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const cardLabel = labels.get(it.card_id) || `${it.iron_number || it.box_id}`
                  const isPersonal = it.alert_days_personal != null
                  const lastDate = it.last_collection || it.opened_at
                  const noCollectionEver = !it.last_collection
                  return (
                    <tr key={it.card_id}>
                      <td>
                        {it.custom_name ? (
                          <>
                            <strong>{it.custom_name}</strong>{' '}
                            <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                              {it.iron_number || it.box_id}
                            </span>
                          </>
                        ) : (
                          <strong>{it.iron_number || it.box_id}</strong>
                        )}
                      </td>
                      <td>
                        <span
                          className="clickable"
                          style={{ color: 'var(--accent)', cursor: 'pointer' }}
                          onClick={() => navigate(`/cards/${it.card_id}`)}
                        >{cardLabel}</span>
                      </td>
                      <td>{it.city || '—'}</td>
                      <td>{it.collector_name || <span style={{ color: 'var(--text3)' }}>לא משויך</span>}</td>
                      <td>
                        {noCollectionEver ? (
                          <span style={{ color: 'var(--text3)' }}>
                            מעולם לא — נפתח {formatDate(it.opened_at)}
                          </span>
                        ) : (
                          formatDate(lastDate)
                        )}
                      </td>
                      <td><strong style={{ color: 'var(--red)' }}>{it.days_since}</strong></td>
                      <td>
                        {isPersonal ? (
                          <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>
                            אישי ({it.alert_days_personal})
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                            גלובלי ({globalThreshold})
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn sm"
                          onClick={() => navigate(`/cards/${it.card_id}`)}
                        >כרטסת</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* === Panel 2: open reports === */}
      <div className="panel">
        <div className="panel-title">דיווחים פתוחים</div>
        {loading ? (
          <div className="loading"><div className="spinner" /><span>טוען...</span></div>
        ) : openReports.length === 0 ? (
          <div className="empty">אין דיווחים פתוחים</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>קופה</th>
                  <th>סוג</th>
                  <th>תיאור</th>
                  <th>ימים פתוח</th>
                  <th>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {openReports.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.iron_number || '—'}</strong></td>
                    <td>{r.icon ? `${r.icon} ` : ''}{r.type_name || '—'}</td>
                    <td>{r.description || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td>{daysSince(r.created_at) ?? '—'}</td>
                    <td className="actions">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn sm warn"
                          onClick={() => setOpenReport(r)}
                        >טיפול</button>
                        {isAdmin && (
                          <button
                            className="btn sm danger"
                            onClick={() => setCloseReport(r)}
                          >🚫 סגור דיווח</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReportModal
        open={!!openReport}
        report={openReport}
        onClose={() => setOpenReport(null)}
        onSaved={handleReportSaved}
      />

      {closeReport && (
        <CloseReportModal
          report={closeReport}
          onClose={() => setCloseReport(null)}
          onClosed={(updated) => {
            handleReportSaved(updated)
            setReloadCounter(c => c + 1)
          }}
        />
      )}
    </div>
  )
}
