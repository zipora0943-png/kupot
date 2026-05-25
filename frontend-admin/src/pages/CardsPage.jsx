import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData, useBootstrap } from '@shared/context/DataStoreContext'
import { computeCardLabels } from '@shared/utils/cardLabel'
import { exportCards } from '../utils/exportToCsv'
import { useSortable, SortableTh } from '../utils/sortable.jsx'

const STATUS_LABELS = {
  active: { label: 'פעילה',     pill: 'green' },
  closed: { label: 'סגורה',     pill: 'gray'  },
}

// Multi-select dropdown — used by the "סוג קופה" filter. Renders a button that
// opens a popover with one checkbox per option; `value` is an array of ids.
// `presets` (optional) is an array of { label, ids } rendered as quick-pick
// buttons at the top of the popover.
function MultiSelect({ options, value, onChange, placeholder = 'בחר…', allLabel = 'הכול', presets }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const selected = new Set(value.map(Number))
  function toggle(id) {
    const n = Number(id)
    if (selected.has(n)) onChange(value.filter(v => Number(v) !== n))
    else onChange([...value, n])
  }

  const summary = value.length === 0
    ? allLabel
    : value.length === 1
      ? (options.find(o => Number(o.id) === Number(value[0]))?.name ?? placeholder)
      : `${value.length} נבחרו`

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 14,
          cursor: 'pointer',
          minWidth: 160,
          textAlign: 'right',
        }}
      >{summary} ▾</button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          zIndex: 20,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: 6,
          minWidth: 220,
          maxHeight: 320,
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>
          {Array.isArray(presets) && presets.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
              padding: '4px 4px 8px',
              borderBottom: '1px solid var(--border)',
              marginBottom: 6,
            }}>
              {presets.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className="btn sm"
                  onClick={() => onChange(p.ids.map(Number))}
                  title={p.title}
                >{p.label}</button>
              ))}
            </div>
          )}
          {options.length === 0 && (
            <div style={{ padding: 8, color: 'var(--text3)', fontSize: 13 }}>אין סוגים</div>
          )}
          {options.map(o => (
            <label
              key={o.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                cursor: 'pointer',
                fontSize: 14,
                borderRadius: 4,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <input
                type="checkbox"
                checked={selected.has(Number(o.id))}
                onChange={() => toggle(o.id)}
              />
              <span>{o.name}</span>
            </label>
          ))}
          {value.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
              <button
                type="button"
                className="btn sm"
                onClick={() => onChange([])}
                style={{ width: '100%' }}
              >נקה בחירה</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CardsPage() {
  const navigate = useNavigate()

  // All four slices come from the central DataStore — populated at login,
  // kept fresh via Socket.IO. No per-mount round-trips.
  const { data: cardsData,    loading } = useData('cards')
  const { data: alertsData            } = useData('alertsNoCollection')
  const { data: reportsAll            } = useData('reports')
  const bootstrap = useBootstrap()
  const allCards = useMemo(() => (Array.isArray(cardsData) ? cardsData : []), [cardsData])
  const types    = useMemo(
    () => (Array.isArray(bootstrap?.box_types) ? bootstrap.box_types : []),
    [bootstrap],
  )
  const alertCount = (() => {
    const n = Number(alertsData?.count)
    if (Number.isFinite(n)) return n
    return Array.isArray(alertsData?.items) ? alertsData.items.length : 0
  })()
  const openReports = useMemo(
    () => (Array.isArray(reportsAll) ? reportsAll.filter((r) => r.status === 'open').length : 0),
    [reportsAll],
  )
  const errMsg = null

  // filters
  const [search,    setSearch]    = useState('')
  const [status,    setStatus]    = useState('')
  const [city,      setCity]      = useState('')
  const [collector, setCollector] = useState('')
  const [typeIds,   setTypeIds]   = useState([])     // array of selected box_type_id (numbers)
  const [statusTab, setStatusTab] = useState('active') // 'active' | 'all'

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
    if (typeIds.length > 0) {
      const set = new Set(typeIds.map(Number))
      list = list.filter(c => c.box_type_id != null && set.has(Number(c.box_type_id)))
    }
    if (search) {
      const q = search.trim().toLowerCase()
      list = list.filter(c => {
        const label = labels.get(c.id) || ''
        return [c.iron_number, c.custom_name, c.city, c.neighborhood, c.street, c.collector_name, label]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      })
    }
    return list
  }, [allCards, statusTab, status, city, collector, typeIds, search, labels])

  const activeCount = useMemo(
    () => allCards.filter(c => c.status === 'active').length,
    [allCards]
  )

  function resetFilters() {
    setSearch(''); setStatus(''); setCity(''); setCollector(''); setTypeIds([])
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
          <div className="field">
            <label>סוג קופה</label>
            <MultiSelect
              options={types}
              value={typeIds}
              onChange={setTypeIds}
              allLabel="כל הסוגים"
              presets={[
                {
                  label: 'כל קופות הרחוב',
                  title: 'כל הסוגים שאינם מסומנים כ"חנות" (מוגדר בדף ההגדרות)',
                  ids: types.filter(t => t.kind !== 'shop').map(t => t.id),
                },
              ]}
            />
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
