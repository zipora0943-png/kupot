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
import { exportCsv, csvFilename } from '../utils/exportCsv'
import { useSortable, SortableTh } from '../utils/sortable.jsx'

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

  // filters — panel 1 (no-collection)
  const [ncSearch,    setNcSearch]    = useState('')
  const [ncCity,      setNcCity]      = useState('')
  const [ncCollector, setNcCollector] = useState('')
  const [ncThreshold, setNcThreshold] = useState('') // '' | 'personal' | 'global'

  // filters — panel 2 (open reports)
  const [repSearch, setRepSearch] = useState('')
  const [repType,   setRepType]   = useState('')

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

  // distinct values for panel-1 dropdowns
  const ncCities = useMemo(() => {
    const set = new Set()
    items.forEach(it => { if (it.city) set.add(it.city) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'))
  }, [items])

  const ncCollectors = useMemo(() => {
    const map = new Map()
    items.forEach(it => {
      const ids   = Array.isArray(it.collector_ids)   ? it.collector_ids   : []
      const names = Array.isArray(it.collector_names) ? it.collector_names : []
      ids.forEach((id, i) => {
        const name = names[i]
        if (id != null && name) map.set(id, name)
      })
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name, 'he'))
  }, [items])

  // distinct types for panel-2
  const repTypes = useMemo(() => {
    const set = new Set()
    openReports.forEach(r => { if (r.type_name) set.add(r.type_name) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'))
  }, [openReports])

  // apply filters — panel 1
  const filteredItems = useMemo(() => {
    let list = items
    if (ncCity)      list = list.filter(it => it.city === ncCity)
    if (ncCollector) {
      const target = Number(ncCollector)
      list = list.filter(it => Array.isArray(it.collector_ids)
        && it.collector_ids.some(id => Number(id) === target))
    }
    if (ncThreshold === 'personal') list = list.filter(it => it.alert_days_personal != null)
    if (ncThreshold === 'global')   list = list.filter(it => it.alert_days_personal == null)
    if (ncSearch) {
      const q = ncSearch.trim().toLowerCase()
      list = list.filter(it => {
        const cardLabel = labels.get(it.card_id) || ''
        return [it.iron_number, it.custom_name, it.city, it.collector_name, it.box_id, it.card_id, cardLabel]
          .filter(v => v != null && v !== '')
          .some(v => String(v).toLowerCase().includes(q))
      })
    }
    return list
  }, [items, ncCity, ncCollector, ncThreshold, ncSearch, labels])

  // apply filters — panel 2
  const filteredReports = useMemo(() => {
    let list = openReports
    if (repType) list = list.filter(r => r.type_name === repType)
    if (repSearch) {
      const q = repSearch.trim().toLowerCase()
      list = list.filter(r =>
        [r.iron_number, r.type_name, r.description, r.reporter_name]
          .filter(v => v != null && v !== '')
          .some(v => String(v).toLowerCase().includes(q))
      )
    }
    return list
  }, [openReports, repType, repSearch])

  function resetNcFilters() {
    setNcSearch(''); setNcCity(''); setNcCollector(''); setNcThreshold('')
  }
  function resetRepFilters() {
    setRepSearch(''); setRepType('')
  }

  // sort: panel-1 (no-collection)
  const ncAccessors = useMemo(() => ({
    name:         (it) => it.custom_name || it.iron_number || String(it.box_id ?? ''),
    card:         (it) => labels.get(it.card_id) || '',
    city:         (it) => it.city,
    collector:    (it) => it.collector_name,
    last:         (it) => {
      const v = it.last_collection || it.opened_at
      return v ? new Date(v) : null
    },
    days:         (it) => Number(it.days_since) || 0,
    threshold:    (it) => it.alert_days_personal != null
                            ? it.alert_days_personal
                            : globalThreshold,
  }), [labels, globalThreshold])
  const { sorted: sortedItems, sort: ncSort, toggle: ncToggle } = useSortable(filteredItems, ncAccessors)

  // sort: panel-2 (open reports)
  const repAccessors = useMemo(() => ({
    iron:    (r) => r.iron_number,
    type:    (r) => r.type_name,
    desc:    (r) => r.description,
    days:    (r) => daysSince(r.created_at) ?? -1,
  }), [])
  const { sorted: sortedReports, sort: repSort, toggle: repToggle } = useSortable(filteredReports, repAccessors)

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
          <>
          <div className="filters-row">
            <div className="field grow">
              <label>חיפוש</label>
              <input
                placeholder="מספר קופה / שם מותאם / עיר / גובה"
                value={ncSearch}
                onChange={(e) => setNcSearch(e.target.value)}
              />
            </div>
            <div className="field">
              <label>עיר</label>
              <select value={ncCity} onChange={(e) => setNcCity(e.target.value)}>
                <option value="">כל הערים</option>
                {ncCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>גובה</label>
              <select value={ncCollector} onChange={(e) => setNcCollector(e.target.value)}>
                <option value="">כל הגובים</option>
                {ncCollectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>סף התראה</label>
              <select value={ncThreshold} onChange={(e) => setNcThreshold(e.target.value)}>
                <option value="">הכל</option>
                <option value="personal">אישי</option>
                <option value="global">גלובלי</option>
              </select>
            </div>
            <button className="btn sm" onClick={resetNcFilters}>↺ איפוס</button>
          </div>

          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              סה"כ: <strong style={{ color: 'var(--text)' }}>{filteredItems.length}</strong>
              {filteredItems.length !== items.length && (
                <span style={{ color: 'var(--text3)' }}> מתוך {items.length}</span>
              )}
            </div>
            <button
              className="btn sm"
              disabled={filteredItems.length === 0}
              onClick={() => exportCsv(
                filteredItems,
                [
                  { key: 'iron_number',     label: 'קופה' },
                  { key: 'custom_name',     label: 'שם מותאם' },
                  { key: 'card_id',         label: 'כרטסת', format: (v) => labels.get(v) || `#${v}` },
                  { key: 'city',            label: 'עיר' },
                  { key: 'collector_name',  label: 'גובה' },
                  { key: 'last_collection', label: 'גביה אחרונה',
                    format: (v, row) => v
                      ? new Date(v).toLocaleDateString('he-IL')
                      : (row.opened_at ? `מעולם לא — נפתח ${new Date(row.opened_at).toLocaleDateString('he-IL')}` : '') },
                  { key: 'days_since',      label: 'ימים' },
                  { key: 'alert_days_personal', label: 'סף התראה',
                    format: (v) => v != null ? `אישי (${v})` : `גלובלי (${globalThreshold})` },
                ],
                csvFilename('alerts_no_collection')
              )}
            >📥 יצוא לאקסל</button>
          </div>
          {filteredItems.length === 0 ? (
            <div className="empty">לא נמצאו קופות התואמות את הסינון</div>
          ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTh sortKey="name"      sort={ncSort} onToggle={ncToggle}>קופה / שם</SortableTh>
                  <SortableTh sortKey="card"      sort={ncSort} onToggle={ncToggle}>כרטסת</SortableTh>
                  <SortableTh sortKey="city"      sort={ncSort} onToggle={ncToggle}>עיר</SortableTh>
                  <SortableTh sortKey="collector" sort={ncSort} onToggle={ncToggle}>גובה</SortableTh>
                  <SortableTh sortKey="last"      sort={ncSort} onToggle={ncToggle}>גביה אחרונה</SortableTh>
                  <SortableTh sortKey="days"      sort={ncSort} onToggle={ncToggle}>ימים</SortableTh>
                  <SortableTh sortKey="threshold" sort={ncSort} onToggle={ncToggle}>סף התראה</SortableTh>
                  <th>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map(it => {
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
          </>
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
          <>
          <div className="filters-row">
            <div className="field grow">
              <label>חיפוש</label>
              <input
                placeholder="מספר קופה / סוג / תיאור / מדווח"
                value={repSearch}
                onChange={(e) => setRepSearch(e.target.value)}
              />
            </div>
            <div className="field">
              <label>סוג דיווח</label>
              <select value={repType} onChange={(e) => setRepType(e.target.value)}>
                <option value="">כל הסוגים</option>
                {repTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button className="btn sm" onClick={resetRepFilters}>↺ איפוס</button>
          </div>

          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              סה"כ: <strong style={{ color: 'var(--text)' }}>{filteredReports.length}</strong>
              {filteredReports.length !== openReports.length && (
                <span style={{ color: 'var(--text3)' }}> מתוך {openReports.length}</span>
              )}
            </div>
            <button
              className="btn sm"
              disabled={filteredReports.length === 0}
              onClick={() => exportCsv(
                filteredReports,
                [
                  { key: 'iron_number',  label: 'קופה' },
                  { key: 'type_name',    label: 'סוג' },
                  { key: 'description',  label: 'תיאור' },
                  { key: 'reporter_name', label: 'מדווח' },
                  { key: 'created_at',   label: 'תאריך פתיחה',
                    format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
                  { key: 'created_at',   label: 'ימים פתוח',
                    format: (v) => daysSince(v) ?? '' },
                ],
                csvFilename('alerts_open_reports')
              )}
            >📥 יצוא לאקסל</button>
          </div>
          {filteredReports.length === 0 ? (
            <div className="empty">לא נמצאו דיווחים התואמים את הסינון</div>
          ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTh sortKey="iron" sort={repSort} onToggle={repToggle}>קופה</SortableTh>
                  <SortableTh sortKey="type" sort={repSort} onToggle={repToggle}>סוג</SortableTh>
                  <SortableTh sortKey="desc" sort={repSort} onToggle={repToggle}>תיאור</SortableTh>
                  <SortableTh sortKey="days" sort={repSort} onToggle={repToggle}>ימים פתוח</SortableTh>
                  <th>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.map(r => (
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
          </>
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
