import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { boxes as boxesApi, cards as cardsApi, boxTypes as boxTypesApi } from '../api/endpoints'
import { computeCardLabels } from '../utils/cardLabel'
import TaskModal from '../components/TaskModal'
import BoxModal from '../components/BoxModal'

// 'no_card' merges legacy 'uninstalled' + 'inactive' (admin treats them as one).
const STATUS_TABS = [
  { key: 'no_card',  label: 'ללא כרטסת פעילה', boxStatuses: ['uninstalled', 'inactive'] },
  { key: 'active',   label: 'כרטסות פעילות',   boxStatuses: ['active'] },
  { key: 'unusable', label: 'לא שמישות',       boxStatuses: ['unusable'] },
]

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function BoxesPage() {
  const navigate = useNavigate()

  const [allBoxes,   setAllBoxes]   = useState([])
  const [allCards,   setAllCards]   = useState([])
  const [types,      setTypes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [errMsg,     setErrMsg]     = useState(null)

  const [activeTab,  setActiveTab]  = useState('no_card')
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // create-task modal — used by "צור משימת התקנה" (box pre-filled, locked)
  const [installBoxId, setInstallBoxId] = useState(null)

  // create-box modal
  const [boxModalOpen, setBoxModalOpen] = useState(false)

  // per-row "in flight" state for status mutations (mark unusable / restore)
  const [statusBusyId, setStatusBusyId] = useState(null)

  function handleBoxCreated(saved) {
    if (!saved) return
    setAllBoxes(prev => [...prev, saved])
  }

  // load boxes + cards (cards needed to show last-card label/date for ex-active boxes)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrMsg(null)
      try {
        const [b, c] = await Promise.all([
          boxesApi.getAll(),
          cardsApi.getAll().catch(() => []),
        ])
        if (!cancelled) {
          setAllBoxes(Array.isArray(b) ? b : [])
          setAllCards(Array.isArray(c) ? c : [])
        }
      } catch (err) {
        if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת קופות')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // load box types (best-effort)
  useEffect(() => {
    boxTypesApi.getAll().then(d => setTypes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // Map<cardId, label> across all cards
  const labels = useMemo(() => computeCardLabels(allCards), [allCards])

  // Map<box_id, lastClosedCard> — for showing prior location on no_card / unusable
  const lastClosedByBox = useMemo(() => {
    const m = new Map()
    for (const c of allCards) {
      if (c.status !== 'closed') continue
      const prev = m.get(c.box_id)
      const t = c.closed_at ? new Date(c.closed_at).getTime() : 0
      const pt = prev?.closed_at ? new Date(prev.closed_at).getTime() : 0
      if (!prev || t > pt) m.set(c.box_id, c)
    }
    return m
  }, [allCards])

  // Map<box_id, activeCard> — for the "active" tab "go to card" link
  const activeCardByBox = useMemo(() => {
    const m = new Map()
    for (const c of allCards) {
      if (c.status === 'active') m.set(c.box_id, c)
    }
    return m
  }, [allCards])

  // counts per tab
  const counts = useMemo(() => {
    const out = { no_card: 0, active: 0, unusable: 0 }
    for (const b of allBoxes) {
      for (const t of STATUS_TABS) {
        if (t.boxStatuses.includes(b.status)) out[t.key]++
      }
    }
    return out
  }, [allBoxes])

  // apply tab + filters
  const filtered = useMemo(() => {
    const tab = STATUS_TABS.find(t => t.key === activeTab)
    let list = allBoxes.filter(b => tab && tab.boxStatuses.includes(b.status))
    if (typeFilter) list = list.filter(b => String(b.box_type_id) === String(typeFilter))
    if (search) {
      const q = search.trim().toLowerCase()
      list = list.filter(b => {
        return [b.iron_number, b.box_type_name, b.notes, b.id]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      })
    }
    return list
  }, [allBoxes, activeTab, typeFilter, search])

  function resetFilters() {
    setSearch(''); setTypeFilter('')
  }

  async function handleMarkUnusable(box) {
    const ok = window.confirm(
      `לסמן את קופה ${box.iron_number || `#${box.id}`} כלא שמישה?\n` +
      'אם קיימת לה כרטסת פעילה — היא תיסגר אוטומטית.'
    )
    if (!ok) return
    const reason = window.prompt('סיבה (אופציונלי):', '') ?? ''
    setErrMsg(null)
    setStatusBusyId(box.id)
    try {
      const updated = await boxesApi.setStatus(box.id, 'unusable', reason.trim() || undefined)
      // server returns the updated box row
      setAllBoxes(prev => prev.map(b => b.id === box.id ? { ...b, ...updated } : b))
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בעדכון סטטוס')
    } finally {
      setStatusBusyId(null)
    }
  }

  async function handleRestoreUsable(box) {
    const ok = window.confirm(
      `להחזיר את קופה ${box.iron_number || `#${box.id}`} לרשימת הקופות השמישות?`
    )
    if (!ok) return
    setErrMsg(null)
    setStatusBusyId(box.id)
    try {
      // restore to 'inactive' (no active card; admin can install via task)
      const updated = await boxesApi.setStatus(box.id, 'inactive')
      setAllBoxes(prev => prev.map(b => b.id === box.id ? { ...b, ...updated } : b))
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בעדכון סטטוס')
    } finally {
      setStatusBusyId(null)
    }
  }

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">קופות</div>
          <div className="page-subtitle">ניהול מלאי הקופות לפי סטטוס</div>
        </div>
        <button className="btn primary" onClick={() => setBoxModalOpen(true)}>
          + קופה חדשה
        </button>
      </div>

      {/* STATS */}
      <div className="stats-row stats-3">
        <div className="stat-card">
          <div className="val">{counts.no_card}</div>
          <div className="lbl">ללא כרטסת פעילה</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--green)' }}>{counts.active}</div>
          <div className="lbl">מותקנות</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--red, #b91c1c)' }}>{counts.unusable}</div>
          <div className="lbl">לא שמישות</div>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            className={'tab-btn' + (activeTab === t.key ? ' active' : '')}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {/* PANEL */}
      <div className="panel">
        <div className="filters-row">
          <div className="field grow">
            <label>חיפוש</label>
            <input
              placeholder="מספר קופה / סוג / הערות"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label>סוג קופה</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">כל הסוגים</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button className="btn sm" onClick={resetFilters}>↺ איפוס</button>
          <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text2)', alignSelf: 'center' }}>
            סה"כ: <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong>
          </div>
        </div>

        {activeTab === 'no_card' && (
          <div className="alert warn" style={{ marginBottom: 14 }}>
            ⚠️ קופות ללא כרטסת פעילה (גם חדשות שלא הותקנו וגם כאלו שכרטסתן נסגרה). ניתן ליצור עבורן משימת התקנה או לסמן כלא שמישות.
          </div>
        )}
        {activeTab === 'active' && (
          <div className="alert info" style={{ marginBottom: 14 }}>
            📋 קופות מותקנות עם כרטסת פעילה. ניתן לסמן כלא שמישה (סוגר את הכרטסת אוטומטית) או לעבור לתצוגת הכרטסת המלאה.
          </div>
        )}
        {activeTab === 'unusable' && (
          <div className="alert red" style={{ marginBottom: 14 }}>
            🚫 קופות שסומנו כלא שמישות (פגומות / אבודות וכד'). אינן מופיעות לגובים. ניתן להחזירן לרשימת הקופות השמישות.
          </div>
        )}

        {errMsg && <div className="alert red">{errMsg}</div>}

        {(
          loading ? (
            <div className="loading"><div className="spinner" /><span>טוען קופות...</span></div>
          ) : filtered.length === 0 ? (
            <div className="empty">לא נמצאו קופות</div>
          ) : activeTab === 'no_card' ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>מספר קופה</th>
                    <th>סוג</th>
                    <th>כרטסת אחרונה</th>
                    <th>תאריך סגירת כרטסת</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => {
                    const last = lastClosedByBox.get(b.id)
                    const lastLabel = last ? (labels.get(last.id) || `#${last.id}`) : '—'
                    const busy = statusBusyId === b.id
                    return (
                      <tr key={b.id}>
                        <td><strong>{b.iron_number || '—'}</strong></td>
                        <td>{b.box_type_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>
                          {last ? (
                            <span
                              className="clickable"
                              style={{ color: 'var(--accent)', cursor: 'pointer' }}
                              onClick={() => navigate(`/cards/${last.id}`)}
                            >{lastLabel}</span>
                          ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td>{last ? formatDate(last.closed_at) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className="btn sm primary"
                            onClick={() => setInstallBoxId(b.id)}
                            disabled={busy}
                          >צור משימת התקנה</button>
                          <button
                            className="btn sm"
                            onClick={() => handleMarkUnusable(b)}
                            disabled={busy}
                            title="העברת הקופה לסטטוס לא-שמישה (תיעלם מרשימות הגביה)"
                          >{busy ? '...' : 'סמן כלא שמישה'}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'active' ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>מספר קופה</th>
                    <th>סוג</th>
                    <th>כרטסת פעילה</th>
                    <th>כתובת</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => {
                    const active = activeCardByBox.get(b.id)
                    const activeLabel = active ? (labels.get(active.id) || `#${active.id}`) : '—'
                    const address = active
                      ? [active.city, active.neighborhood, active.street && `${active.street}${active.building ? ' ' + active.building : ''}`]
                          .filter(Boolean).join(', ')
                      : ''
                    const busy = statusBusyId === b.id
                    const goToCard = () => { if (active) navigate(`/cards/${active.id}`) }
                    return (
                      <tr
                        key={b.id}
                        className={active ? 'clickable' : undefined}
                        role={active ? 'button' : undefined}
                        tabIndex={active ? 0 : undefined}
                        onClick={active ? goToCard : undefined}
                        onKeyDown={active ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            goToCard()
                          }
                        } : undefined}
                      >
                        <td><strong>{b.iron_number || '—'}</strong></td>
                        <td>{b.box_type_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>
                          {active
                            ? <span style={{ fontWeight: 500, color: 'var(--accent)' }}>{activeLabel}</span>
                            : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td>{address || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className="btn sm danger"
                            onClick={(e) => { e.stopPropagation(); handleMarkUnusable(b) }}
                            disabled={busy}
                            title="סוגר את הכרטסת הפעילה ומסמן את הקופה כלא-שמישה"
                          >{busy ? '...' : '🚫 סמן כלא שמישה'}</button>
                          <button
                            className="btn sm"
                            onClick={(e) => { e.stopPropagation(); if (active) navigate(`/cards/${active.id}`) }}
                            disabled={busy || !active}
                            title="פתיחת תצוגת הכרטסת המלאה"
                          >📇 עבור לתצוגת כרטסת</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            // unusable tab
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>מספר קופה</th>
                    <th>סוג</th>
                    <th>כרטסת אחרונה</th>
                    <th>הערות</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => {
                    const last = lastClosedByBox.get(b.id)
                    const lastLabel = last ? (labels.get(last.id) || `#${last.id}`) : '—'
                    const busy = statusBusyId === b.id
                    return (
                      <tr key={b.id}>
                        <td><strong>{b.iron_number || '—'}</strong></td>
                        <td>{b.box_type_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>
                          {last ? (
                            <span
                              className="clickable"
                              style={{ color: 'var(--accent)', cursor: 'pointer' }}
                              onClick={() => navigate(`/cards/${last.id}`)}
                            >{lastLabel}</span>
                          ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td>{b.notes || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>
                          <button
                            className="btn sm primary"
                            onClick={() => handleRestoreUsable(b)}
                            disabled={busy}
                          >{busy ? '...' : 'החזר לשימוש'}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <TaskModal
        open={installBoxId != null}
        defaults={{ box_id: installBoxId, lockBox: true }}
        onClose={() => setInstallBoxId(null)}
        onSaved={() => { /* nothing to update on this page */ }}
      />

      <BoxModal
        open={boxModalOpen}
        onClose={() => setBoxModalOpen(false)}
        onSaved={handleBoxCreated}
      />
    </div>
  )
}
