import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '@shared/context/DataStoreContext'
import { computeCardLabels } from '@shared/utils/cardLabel'
import CashroomModal from '../components/CashroomModal'
import { exportEnvelopes } from '../utils/exportToCsv'
import PaginatedTable from '../utils/PaginatedTable.jsx'

const STATUS_LABELS = {
  pending: { label: 'ממתין', pill: 'yellow' },
  entered: { label: 'הוזן',  pill: 'green'  },
}

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

function isThisMonth(iso) {
  if (!iso) return false
  const d = new Date(iso)
  if (isNaN(d)) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export default function EnvelopesPage() {
  const navigate = useNavigate()

  // Envelopes + cards come from the central DataStore.
  const { data: envsData,  loading } = useData('envelopes')
  const { data: cardsData          } = useData('cards')
  const allEnvs  = useMemo(() => (Array.isArray(envsData)  ? envsData  : []), [envsData])
  const allCards = useMemo(() => (Array.isArray(cardsData) ? cardsData : []), [cardsData])
  const errMsg = null

  // filters
  const [search,    setSearch]    = useState('')
  const [status,    setStatus]    = useState('')
  const [collector, setCollector] = useState('')
  const [city,      setCity]      = useState('')
  const [from,      setFrom]      = useState('')
  const [to,        setTo]        = useState('')

  // modal
  const [openEnv, setOpenEnv] = useState(null)

  // Store refresh via socket after a save — no local patch needed.
  function handleEnvSaved() { /* store refreshes via socket */ }

  // Map<cardId, label> across all cards (so letters reflect true chronological order)
  const labels = useMemo(() => computeCardLabels(allCards), [allCards])

  // distinct values for filter dropdowns
  const cities = useMemo(() => {
    const s = new Set()
    allEnvs.forEach(e => { if (e.city) s.add(e.city) })
    return Array.from(s).sort()
  }, [allEnvs])

  const collectors = useMemo(() => {
    const m = new Map()
    allEnvs.forEach(e => {
      if (e.collected_by && e.collector_name) m.set(e.collected_by, e.collector_name)
    })
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'))
  }, [allEnvs])

  // apply filters in-memory
  const filtered = useMemo(() => {
    let list = allEnvs
    if (status)    list = list.filter(e => e.status === status)
    if (collector) list = list.filter(e => String(e.collected_by) === String(collector))
    if (city)      list = list.filter(e => e.city === city)
    if (from) {
      const t = new Date(from).getTime()
      if (Number.isFinite(t)) list = list.filter(e => e.collected_at && new Date(e.collected_at).getTime() >= t)
    }
    if (to) {
      const d = new Date(to)
      d.setHours(23, 59, 59, 999)
      const t = d.getTime()
      if (Number.isFinite(t)) list = list.filter(e => e.collected_at && new Date(e.collected_at).getTime() <= t)
    }
    if (search) {
      const q = search.trim().toLowerCase()
      list = list.filter(e => {
        const label = labels.get(e.card_id) || ''
        return [e.envelope_number, e.iron_number, e.city, e.neighborhood, e.street, e.collector_name, label]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      })
    }
    return list
  }, [allEnvs, status, collector, city, from, to, search, labels])

  // stats
  const stats = useMemo(() => {
    let totalThisMonth = 0
    let pendingCount   = 0
    let monthCount     = 0
    for (const e of allEnvs) {
      if (e.status === 'pending') pendingCount++
      if (isThisMonth(e.collected_at)) {
        monthCount++
        if (e.status === 'entered' && e.amount != null) totalThisMonth += Number(e.amount) || 0
      }
    }
    return { totalThisMonth, pendingCount, monthCount }
  }, [allEnvs])

  function resetFilters() {
    setSearch(''); setStatus(''); setCollector(''); setCity(''); setFrom(''); setTo('')
  }

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">כל המעטפות</div>
          <div className="page-subtitle">רשימה מלאה — כל הגובים, כל הקופות</div>
        </div>
        <button
          className="btn sm"
          disabled={filtered.length === 0}
          onClick={() => exportEnvelopes(filtered, `מעטפות_${new Date().toLocaleDateString('he-IL')}`)}
        >📥 יצוא לאקסל</button>
      </div>

      {/* STATS */}
      <div className="stats-row stats-3">
        <div className="stat-card">
          <div className="val">{formatMoney(stats.totalThisMonth) || '₪0'}</div>
          <div className="lbl">סה"כ הוזן החודש</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--yellow)' }}>{stats.pendingCount}</div>
          <div className="lbl">ממתינות להזנה</div>
        </div>
        <div className="stat-card">
          <div className="val">{stats.monthCount}</div>
          <div className="lbl">מעטפות החודש</div>
        </div>
      </div>

      {/* PANEL */}
      <div className="panel">
        <div className="filters-row">
          <div className="field grow">
            <label>חיפוש</label>
            <input
              placeholder="מס' מעטפה / קופה / כרטסת / עיר / גובה"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label>סטטוס</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">הכל</option>
              <option value="entered">הוזן</option>
              <option value="pending">ממתין</option>
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
            <label>עיר</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">כל הערים</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>מתאריך</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>עד תאריך</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
          <div className="loading"><div className="spinner" /><span>טוען מעטפות...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty">לא נמצאו מעטפות התואמות את הסינון</div>
        ) : (
          <PaginatedTable
            data={filtered}
            getRowKey={(e) => e.id}
            header={(
              <tr>
                <th>תאריך גביה</th>
                <th>מס' מעטפה</th>
                <th>קופה</th>
                <th>כרטסת</th>
                <th>עיר</th>
                <th>גובה</th>
                <th>סכום</th>
                <th>סטטוס</th>
                <th>פעולה</th>
              </tr>
            )}
            renderRow={(e) => {
              const st = STATUS_LABELS[e.status] || { label: e.status, pill: 'gray' }
              const label = labels.get(e.card_id) || `#${e.card_id}`
              const money = formatMoney(e.amount)
              return (
                <>
                  <td>{formatDate(e.collected_at)}</td>
                  <td><strong>{e.envelope_number || '—'}</strong></td>
                  <td>{e.iron_number || '—'}</td>
                  <td>
                    <span
                      className="clickable"
                      style={{ color: 'var(--accent)', cursor: 'pointer' }}
                      onClick={() => navigate(`/cards/${e.card_id}`)}
                    >{label}</span>
                  </td>
                  <td>{e.city || '—'}</td>
                  <td>{e.collector_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td>
                    {money
                      ? money
                      : <span style={{ color: 'var(--text3)' }}>ממתין</span>}
                  </td>
                  <td><span className={'pill ' + st.pill}>{st.label}</span></td>
                  <td className="actions">
                    {e.status === 'pending' ? (
                      <button
                        className="btn sm primary"
                        onClick={() => setOpenEnv(e)}
                      >הזנת סכום</button>
                    ) : (
                      <button
                        className="btn sm"
                        onClick={() => setOpenEnv(e)}
                      >פרטים</button>
                    )}
                    <button
                      className="btn sm"
                      onClick={() => navigate(`/cards/${e.card_id}`)}
                    >כרטסת</button>
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
