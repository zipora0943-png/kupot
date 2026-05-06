import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  reports as reportsApi,
  cards as cardsApi,
  reportTypes as reportTypesApi,
} from '../api/endpoints'
import { computeCardLabels } from '../utils/cardLabel'
import ReportModal from '../components/ReportModal'
import ManualReportModal from '../components/ManualReportModal'
import CloseReportModal from '../components/CloseReportModal'
import { exportReports } from '../utils/exportToCsv'
import { useAuth } from '../context/AuthContext'
import { useSortable, SortableTh } from '../utils/sortable.jsx'

const STATUS_LABELS = {
  open:      { label: 'פתוח',  pill: 'yellow' },
  converted: { label: 'בטיפול', pill: 'blue'  },
  closed:    { label: 'סגור',  pill: 'gray'   },
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreate = user?.role === 'admin'
  const canCreateReport = user?.role === 'admin' || user?.role === 'collector'

  const [allReports, setAllReports] = useState([])
  const [allCards,   setAllCards]   = useState([])
  const [types,      setTypes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [errMsg,     setErrMsg]     = useState(null)
  const [reloadCounter, setReloadCounter] = useState(0)

  // filters
  const [search,    setSearch]    = useState('')
  const [status,    setStatus]    = useState('')
  const [typeId,    setTypeId]    = useState('')

  // modal
  const [openReport,  setOpenReport]  = useState(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [closeReport, setCloseReport] = useState(null)

  function handleReportSaved(updated) {
    if (!updated) return
    setAllReports(prev => prev.map(r =>
      r.id === updated.id ? { ...r, ...updated } : r
    ))
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrMsg(null)
      try {
        const [r, c] = await Promise.all([
          reportsApi.getAll(),
          cardsApi.getAll().catch(() => []),
        ])
        if (!cancelled) {
          setAllReports(Array.isArray(r) ? r : [])
          setAllCards(Array.isArray(c) ? c : [])
        }
      } catch (err) {
        if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת דיווחים')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [reloadCounter])

  useEffect(() => {
    reportTypesApi.getAll().then(d => setTypes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // Card labels (1019A...)
  const labels = useMemo(() => computeCardLabels(allCards), [allCards])

  // counts by status
  const stats = useMemo(() => {
    const c = { open: 0, converted: 0, closed: 0 }
    for (const r of allReports) {
      if (c[r.status] !== undefined) c[r.status]++
    }
    return c
  }, [allReports])

  // apply filters
  const filtered = useMemo(() => {
    let list = allReports
    if (status) list = list.filter(r => r.status === status)
    if (typeId) list = list.filter(r => String(r.report_type_id) === String(typeId))
    if (search) {
      const q = search.trim().toLowerCase()
      list = list.filter(r => {
        const label = labels.get(r.card_id) || ''
        return [r.iron_number, r.type_name, r.description, r.reporter_name, r.city, r.id, label]
          .filter(v => v !== null && v !== undefined && v !== '')
          .some(v => String(v).toLowerCase().includes(q))
      })
    }
    return list
  }, [allReports, status, typeId, search, labels])

  function resetFilters() {
    setSearch(''); setStatus(''); setTypeId('')
  }

  const sortAccessors = useMemo(() => ({
    date:     (r) => r.created_at ? new Date(r.created_at) : null,
    iron:     (r) => r.iron_number,
    card:     (r) => r.card_id ? (labels.get(r.card_id) || '') : '',
    type:     (r) => r.type_name,
    desc:     (r) => r.description,
    reporter: (r) => r.reporter_name,
    status:   (r) => STATUS_LABELS[r.status]?.label || r.status,
  }), [labels])
  const { sorted, sort, toggle } = useSortable(filtered, sortAccessors)

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">דיווחים</div>
          <div className="page-subtitle">דיווחי תקלות מהשטח — לטיפול והמרה למשימות</div>
        </div>
        <div className="entity-actions">
          <button
            className="btn sm"
            disabled={filtered.length === 0}
            onClick={() => exportReports(filtered, `דיווחים_${new Date().toLocaleDateString('he-IL')}`)}
          >📥 יצוא לאקסל</button>
          {canCreateReport && (
            <button
              className="btn primary"
              onClick={() => setShowCreate(true)}
            >➕ צור דיווח</button>
          )}
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row stats-3">
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--yellow)' }}>{stats.open}</div>
          <div className="lbl">פתוחים</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--accent)' }}>{stats.converted}</div>
          <div className="lbl">בטיפול</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--text3)' }}>{stats.closed}</div>
          <div className="lbl">סגורים</div>
        </div>
      </div>

      {/* PANEL */}
      <div className="panel">
        <div className="filters-row">
          <div className="field grow">
            <label>חיפוש</label>
            <input
              placeholder="קופה / כרטסת / סוג / תיאור / גובה"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label>סטטוס</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">הכל</option>
              <option value="open">פתוח</option>
              <option value="converted">בטיפול</option>
              <option value="closed">סגור</option>
            </select>
          </div>
          <div className="field">
            <label>סוג</label>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">הכל</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button className="btn sm" onClick={resetFilters}>↺ איפוס</button>
        </div>

        <div className="actions" style={{ marginBottom: 12 }}>
          <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text2)' }}>
            סה"כ: <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong>
          </div>
        </div>

        {errMsg && <div className="alert red">{errMsg}</div>}

        {loading ? (
          <div className="loading"><div className="spinner" /><span>טוען דיווחים...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty">לא נמצאו דיווחים התואמים את הסינון</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTh sortKey="date"     sort={sort} onToggle={toggle}>תאריך</SortableTh>
                  <SortableTh sortKey="iron"     sort={sort} onToggle={toggle}>קופה</SortableTh>
                  <SortableTh sortKey="card"     sort={sort} onToggle={toggle}>כרטסת</SortableTh>
                  <SortableTh sortKey="type"     sort={sort} onToggle={toggle}>סוג</SortableTh>
                  <SortableTh sortKey="desc"     sort={sort} onToggle={toggle}>תיאור</SortableTh>
                  <SortableTh sortKey="reporter" sort={sort} onToggle={toggle}>גובה</SortableTh>
                  <SortableTh sortKey="status"   sort={sort} onToggle={toggle}>סטטוס</SortableTh>
                  <th>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const st = STATUS_LABELS[r.status] || { label: r.status, pill: 'gray' }
                  const cardLabel = r.card_id ? (labels.get(r.card_id) || `#${r.card_id}`) : null
                  return (
                    <tr key={r.id}>
                      <td>{formatDate(r.created_at)}</td>
                      <td><strong>{r.iron_number || '—'}</strong></td>
                      <td>
                        {cardLabel ? (
                          <span
                            className="clickable"
                            style={{ color: 'var(--accent)', cursor: 'pointer' }}
                            onClick={() => navigate(`/cards/${r.card_id}`)}
                          >{cardLabel}</span>
                        ) : '—'}
                      </td>
                      <td>
                        {r.icon ? `${r.icon} ` : ''}
                        {r.type_name || '—'}
                      </td>
                      <td>{r.description || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td>{r.reporter_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td>
                        <span
                          className={'pill ' + st.pill}
                          title={r.status === 'closed' && r.closure_reason ? `סיבת סגירה: ${r.closure_reason}` : undefined}
                        >{st.label}</span>
                      </td>
                      <td className="actions" style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                        {r.status === 'open' ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                            <button
                              className="btn sm warn"
                              onClick={() => setOpenReport(r)}
                            >טיפול / המרה</button>
                            {canCreate && (
                              <button
                                className="btn sm danger"
                                onClick={() => setCloseReport(r)}
                              >🚫 סגור דיווח</button>
                            )}
                          </div>
                        ) : (
                          <button
                            className="btn sm"
                            onClick={() => setOpenReport(r)}
                          >פתיחה</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
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

      {showCreate && (
        <ManualReportModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setReloadCounter(c => c + 1)}
        />
      )}

      {closeReport && (
        <CloseReportModal
          report={closeReport}
          onClose={() => setCloseReport(null)}
          onClosed={(updated) => handleReportSaved(updated)}
        />
      )}
    </div>
  )
}
