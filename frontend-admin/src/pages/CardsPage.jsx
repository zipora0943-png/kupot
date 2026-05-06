import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cards as cardsApi, alerts as alertsApi, reports as reportsApi } from '../api/endpoints'
import { computeCardLabels } from '../utils/cardLabel'
import { exportCards } from '../utils/exportToCsv'
import { useSortable, SortableTh } from '../utils/sortable.jsx'

const STATUS_LABELS = {
  active: { label: 'פעילה',     pill: 'green' },
  closed: { label: 'סגורה',     pill: 'gray'  },
}

export default function CardsPage() {
  const navigate = useNavigate()

  const [allCards, setAllCards]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [errMsg, setErrMsg]       = useState(null)

  // stats
  const [alertCount,    setAlertCount]    = useState(0)
  const [openReports,   setOpenReports]   = useState(0)

  // filters
  const [search,    setSearch]    = useState('')
  const [status,    setStatus]    = useState('')
  const [city,      setCity]      = useState('')
  const [collector, setCollector] = useState('')
  const [statusTab, setStatusTab] = useState('active') // 'active' | 'all'

  // load cards once on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrMsg(null)
      try {
        const data = await cardsApi.getAll()
        if (!cancelled) setAllCards(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת כרטסות')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // load stats (best-effort, errors silenced)
  useEffect(() => {
    alertsApi.noCollection()
      .then(d => setAlertCount(typeof d?.count === 'number' ? d.count : (Array.isArray(d?.items) ? d.items.length : 0)))
      .catch(() => {})
    reportsApi.getAll({ status: 'open' }).then(d => setOpenReports(Array.isArray(d) ? d.length : 0)).catch(() => {})
  }, [])

  // distinct values for filter dropdowns
  const cities = useMemo(() => {
    const set = new Set()
    allCards.forEach(c => { if (c.city) set.add(c.city) })
    return Array.from(set).sort()
  }, [allCards])

  const collectors = useMemo(() => {
    const map = new Map()
    allCards.forEach(c => {
      const ids   = Array.isArray(c.collector_ids)   ? c.collector_ids   : []
      const names = Array.isArray(c.collector_names) ? c.collector_names : []
      ids.forEach((id, i) => {
        const name = names[i]
        if (id != null && name) map.set(id, name)
      })
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name, 'he'))
  }, [allCards])

  // Map<cardId, label> e.g. "1019A" — computed across ALL cards (active + closed)
  // so letters reflect the true chronological order per box.
  const labels = useMemo(() => computeCardLabels(allCards), [allCards])

  // apply filters in-memory
  const filtered = useMemo(() => {
    let list = allCards
    if (statusTab === 'active') list = list.filter(c => c.status === 'active')
    if (status)    list = list.filter(c => c.status === status)
    if (city)      list = list.filter(c => c.city === city)
    if (collector) {
      const target = Number(collector)
      list = list.filter(c => Array.isArray(c.collector_ids)
        && c.collector_ids.some(id => Number(id) === target))
    }
    if (search) {
      const q = search.trim().toLowerCase()
      list = list.filter(c => {
        const label = labels.get(c.id) || ''
        return [c.iron_number, c.custom_name, c.city, c.neighborhood, c.street, c.collector_name, c.id, label]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      })
    }
    return list
  }, [allCards, statusTab, status, city, collector, search, labels])

  const activeCount = useMemo(
    () => allCards.filter(c => c.status === 'active').length,
    [allCards]
  )

  function resetFilters() {
    setSearch(''); setStatus(''); setCity(''); setCollector('')
  }

  const sortAccessors = useMemo(() => ({
    iron:         (c) => c.iron_number,
    card:         (c) => labels.get(c.id) || '',
    city:         (c) => c.city,
    neighborhood: (c) => c.neighborhood,
    street:       (c) => c.street,
    building:     (c) => c.building,
    collector:    (c) => c.collector_name,
    last:         (c) => c.last_collection_at ? new Date(c.last_collection_at) : null,
    status:       (c) => STATUS_LABELS[c.status]?.label || c.status,
    flags:        (c) => (c.has_open_report ? 2 : 0) + (c.has_open_task ? 1 : 0),
  }), [labels])
  const { sorted, sort, toggle } = useSortable(filtered, sortAccessors)

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">כרטסות</div>
          <div className="page-subtitle">לחץ על שורה כדי להיכנס לכרטסת</div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row stats-3">
        <div className="stat-card">
          <div className="val">{activeCount}</div>
          <div className="lbl">כרטסות פעילות</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--red)' }}>{alertCount}</div>
          <div className="lbl">לא רוקנו {/* days global */}</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--yellow)' }}>{openReports}</div>
          <div className="lbl">דיווחים פתוחים</div>
        </div>
      </div>

      {/* PANEL: filters + table */}
      <div className="panel">
        <div className="filters-row">
          <div className="field grow">
            <label>חיפוש</label>
            <input
              placeholder="מספר קופה / כרטסת / עיר / רחוב / גובה"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label>סטטוס</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">כל הסטטוסים</option>
              <option value="active">פעילה</option>
              <option value="closed">סגורה</option>
            </select>
          </div>
          <div className="field">
            <label>עיר</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">כל הערים</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>גובה</label>
            <select value={collector} onChange={(e) => setCollector(e.target.value)}>
              <option value="">כל הגובים</option>
              {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn sm" onClick={resetFilters}>↺ איפוס</button>
        </div>

        <div className="actions" style={{ marginBottom: 12 }}>
          <button
            className={'btn sm' + (statusTab === 'active' ? ' primary' : '')}
            onClick={() => setStatusTab('active')}
          >פעילות</button>
          <button
            className={'btn sm' + (statusTab === 'all' ? ' primary' : '')}
            onClick={() => setStatusTab('all')}
          >כל הכרטסות</button>
          <button
            className="btn sm"
            onClick={() => exportCards(filtered, `כרטסות_${new Date().toLocaleDateString('he-IL')}`)}
            disabled={filtered.length === 0}
          >📥 יצוא לאקסל</button>
          <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text2)' }}>
            סה"כ: <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong>
          </div>
        </div>

        {errMsg && <div className="alert red">{errMsg}</div>}

        {loading ? (
          <div className="loading"><div className="spinner" /><span>טוען כרטסות...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty">לא נמצאו כרטסות התואמות את הסינון</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTh sortKey="iron"         sort={sort} onToggle={toggle}>קופה</SortableTh>
                  <SortableTh sortKey="card"         sort={sort} onToggle={toggle}>כרטסת</SortableTh>
                  <SortableTh sortKey="city"         sort={sort} onToggle={toggle}>עיר</SortableTh>
                  <SortableTh sortKey="neighborhood" sort={sort} onToggle={toggle}>שכונה</SortableTh>
                  <SortableTh sortKey="street"       sort={sort} onToggle={toggle}>רחוב</SortableTh>
                  <SortableTh sortKey="building"     sort={sort} onToggle={toggle}>בנין</SortableTh>
                  <SortableTh sortKey="collector"    sort={sort} onToggle={toggle}>גובה</SortableTh>
                  <SortableTh sortKey="last"         sort={sort} onToggle={toggle}>גביה אחרונה</SortableTh>
                  <SortableTh sortKey="status"       sort={sort} onToggle={toggle}>סטטוס</SortableTh>
                  <SortableTh sortKey="flags"        sort={sort} onToggle={toggle}>סימונים</SortableTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(c => {
                  const st = STATUS_LABELS[c.status] || { label: c.status, pill: 'gray' }
                  const label = labels.get(c.id) || `#${c.id}`
                  const cardLabel = c.custom_name
                    ? <><strong>{c.custom_name}</strong> <span style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</span></>
                    : <strong>{label}</strong>
                  const lastCollection = c.last_collection_at
                    ? new Date(c.last_collection_at).toLocaleDateString('he-IL')
                    : <span style={{ color: 'var(--text3)' }}>—</span>
                  return (
                    <tr key={c.id} className="clickable" onClick={() => navigate(`/cards/${c.id}`)}>
                      <td><strong>{c.iron_number || '—'}</strong></td>
                      <td>{cardLabel}</td>
                      <td>{c.city || '—'}</td>
                      <td>{c.neighborhood || '—'}</td>
                      <td>{c.street || '—'}</td>
                      <td>{c.building || '—'}</td>
                      <td>{c.collector_name || <span style={{ color: 'var(--text3)' }}>לא משויך</span>}</td>
                      <td>{lastCollection}</td>
                      <td><span className={'pill ' + st.pill}>{st.label}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {c.has_open_report && (
                            <span className="pill yellow" title="יש דיווח פתוח על הכרטסת">⚠ דיווח פתוח</span>
                          )}
                          {c.has_open_task && (
                            <span className="pill blue" title="יש משימה פתוחה על הכרטסת">📋 משימה פתוחה</span>
                          )}
                          {!c.has_open_report && !c.has_open_task && (
                            <span style={{ color: 'var(--text3)' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn sm primary"
                          onClick={(e) => { e.stopPropagation(); navigate(`/cards/${c.id}`) }}
                        >פתיחה</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
