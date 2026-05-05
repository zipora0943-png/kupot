import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  reportsExport as reportsExportApi,
  envelopes as envelopesApi,
  cards as cardsApi,
  boxes as boxesApi,
  boxTypes as boxTypesApi,
} from '../api/endpoints'
import { computeCardLabels } from '../utils/cardLabel'
import { exportCsv, csvFilename } from '../utils/exportCsv'
import MonthYearPicker from '../components/MonthYearPicker'

const TABS = [
  { key: 'summary', label: 'סיכום כללי' },
  { key: 'perbox',  label: 'פר קופה' },
  { key: 'compare', label: 'השוואה' },
]

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return '₪' + num.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

// Period helpers — translate the period selector + values into { from, to }.
function periodToRange(period, monthVal, yearVal, fromVal, toVal) {
  if (period === 'month' && monthVal) {
    // "YYYY-MM" → first and last day of that month
    const [y, m] = monthVal.split('-').map(Number)
    if (!y || !m) return { from: null, to: null }
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { from, to }
  }
  if (period === 'year' && yearVal) {
    return { from: `${yearVal}-01-01`, to: `${yearVal}-12-31` }
  }
  if (period === 'range') {
    return { from: fromVal || null, to: toVal || null }
  }
  return { from: null, to: null }
}

// =============================================================================
// === Tab 1: סיכום כללי =======================================================
// =============================================================================
function SummaryTab() {
  const today = new Date()
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const [period,    setPeriod]    = useState('month')
  const [monthVal,  setMonthVal]  = useState(defaultMonth)
  const [yearVal,   setYearVal]   = useState(String(today.getFullYear()))
  const [fromVal,   setFromVal]   = useState('')
  const [toVal,     setToVal]     = useState('')
  const [city,      setCity]      = useState('')
  const [collectorName, setCollectorName] = useState('')
  const [customName,    setCustomName]    = useState('')
  const [receiptFilter, setReceiptFilter] = useState('') // '', 'yes', 'no'

  const [rows, setRows]     = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg]   = useState(null)

  // load distinct cities once (from /cards)
  const [cities, setCities] = useState([])
  const [collectors, setCollectors] = useState([])
  useEffect(() => {
    cardsApi.getAll().then(d => {
      const arr = Array.isArray(d) ? d : []
      const cs = new Set(); const cmap = new Map()
      for (const c of arr) {
        if (c.city) cs.add(c.city)
        if (c.collector_id && c.collector_name) cmap.set(c.collector_id, c.collector_name)
      }
      setCities(Array.from(cs).sort())
      setCollectors(Array.from(cmap.values()).sort((a, b) => a.localeCompare(b, 'he')))
    }).catch(() => {})
  }, [])

  async function generate() {
    setErrMsg(null)
    const { from, to } = periodToRange(period, monthVal, yearVal, fromVal, toVal)
    setLoading(true)
    try {
      const data = await reportsExportApi.perBox({
        from, to,
        city: city || undefined,
        custom_name: customName.trim() || undefined,
        receipt_required:
          receiptFilter === 'yes' ? 'true'
          : receiptFilter === 'no' ? 'false'
          : undefined,
      })
      let list = Array.isArray(data) ? data : []
      // collector filter — server doesn't filter by collector, so do it client-side
      if (collectorName) list = list.filter(r => r.collector_name === collectorName)
      setRows(list)
      setLoaded(true)
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בהפקת הדוח')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const total = rows.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0)
    const envelopes = rows.reduce((acc, r) => acc + (Number(r.collection_count) || 0), 0)
    const activeCount = rows.length
    const avg = activeCount ? Math.round(total / activeCount) : 0
    return { total, envelopes, activeCount, avg }
  }, [rows])

  function exportSummary() {
    if (rows.length === 0) return
    const cols = [
      { key: 'iron_number',   label: 'קופה' },
      { key: 'custom_name',   label: 'שם מותאם' },
      { key: 'city',          label: 'עיר' },
      { key: 'neighborhood',  label: 'שכונה' },
      { key: 'street',        label: 'רחוב' },
      { key: 'building',      label: 'מספר בית' },
      { key: 'collector_name',label: 'גובה' },
      { key: 'receipt_required', label: 'מעוניין בקבלה',
        format: (v) => (v ? 'כן' : 'לא') },
      { key: 'total_amount',  label: 'סה"כ' },
      { key: 'collection_count', label: 'מעטפות' },
      { key: 'last_collection_date', label: 'גביה אחרונה',
        format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
    ]
    exportCsv(rows, cols, csvFilename('summary'))
  }

  return (
    <div>
      <div className="filters-row">
        <div className="field">
          <label>סוג תקופה</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="month">חודשי</option>
            <option value="year">שנתי</option>
            <option value="range">טווח חופשי</option>
          </select>
        </div>
        {period === 'month' && (
          <div className="field"><label>חודש / שנה</label>
            <MonthYearPicker value={monthVal} onChange={setMonthVal} />
          </div>
        )}
        {period === 'year' && (
          <div className="field"><label>שנה</label>
            <input type="number" min="2000" max="2100" value={yearVal} onChange={(e) => setYearVal(e.target.value)} />
          </div>
        )}
        {period === 'range' && (
          <>
            <div className="field"><label>מתאריך</label>
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} />
            </div>
            <div className="field"><label>עד תאריך</label>
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} />
            </div>
          </>
        )}
        <div className="field">
          <label>עיר</label>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">כל הערים</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>גובה</label>
          <select value={collectorName} onChange={(e) => setCollectorName(e.target.value)}>
            <option value="">כל הגובים</option>
            {collectors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>שם מותאם אישית</label>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="חיפוש חלקי"
          />
        </div>
        <div className="field">
          <label>מעוניין בקבלה</label>
          <select value={receiptFilter} onChange={(e) => setReceiptFilter(e.target.value)}>
            <option value="">הכל</option>
            <option value="yes">כן</option>
            <option value="no">לא</option>
          </select>
        </div>
        <button className="btn primary" onClick={generate} disabled={loading}>
          {loading ? 'מפיק...' : 'הפק דוח'}
        </button>
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}

      {loaded && (
        <>
          <div className="stats-row stats-4" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="val">{formatMoney(stats.total)}</div>
              <div className="lbl">סה"כ גביה</div>
            </div>
            <div className="stat-card">
              <div className="val">{stats.activeCount}</div>
              <div className="lbl">קופות בדוח</div>
            </div>
            <div className="stat-card">
              <div className="val">{formatMoney(stats.avg)}</div>
              <div className="lbl">ממוצע לקופה</div>
            </div>
            <div className="stat-card">
              <div className="val">{stats.envelopes}</div>
              <div className="lbl">מעטפות</div>
            </div>
          </div>

          <div className="panel">
            {rows.length === 0 ? (
              <div className="empty">אין נתונים להצגה לפי הפילטרים שנבחרו</div>
            ) : (
              <>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn sm" onClick={exportSummary}>📥 יצוא לאקסל</button>
                </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>קופה</th>
                      <th>שם / מיקום</th>
                      <th>עיר</th>
                      <th>שכונה</th>
                      <th>גובה</th>
                      <th>קבלה</th>
                      <th>סה"כ</th>
                      <th>מעטפות</th>
                      <th>ממוצע</th>
                      <th>גביה אחרונה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const total = Number(r.total_amount) || 0
                      const count = Number(r.collection_count) || 0
                      const avg = count ? Math.round(total / count) : 0
                      return (
                        <tr key={r.iron_number}>
                          <td><strong>{r.iron_number}</strong></td>
                          <td>
                            {r.custom_name
                              ? <strong>{r.custom_name}</strong>
                              : (r.street ? `${r.street}${r.building ? ' ' + r.building : ''}` : '—')}
                          </td>
                          <td>{r.city || '—'}</td>
                          <td>{r.neighborhood || '—'}</td>
                          <td>{r.collector_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                          <td>
                            {r.receipt_required
                              ? <span className="pill green">כן</span>
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </td>
                          <td><strong>{formatMoney(total)}</strong></td>
                          <td>{count}</td>
                          <td>{count ? formatMoney(avg) : '—'}</td>
                          <td>{r.last_collection_date ? formatDate(r.last_collection_date) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </>
      )}

      {!loaded && !loading && (
        <div className="alert info">💡 בחר פילטרים ולחץ "הפק דוח"</div>
      )}
    </div>
  )
}

// =============================================================================
// === Tab 2: פר קופה ==========================================================
// =============================================================================
function PerBoxTab() {
  const [ironInput, setIronInput] = useState('')
  const [fromVal, setFromVal] = useState('')
  const [toVal,   setToVal]   = useState('')

  const [boxInfo,  setBoxInfo]  = useState(null)  // { iron_number, city, ... }
  const [cardInfo, setCardInfo] = useState(null)
  const [envs,     setEnvs]     = useState([])
  const [loaded,   setLoaded]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [errMsg,   setErrMsg]   = useState(null)

  async function generate() {
    setErrMsg(null)
    if (!ironInput.trim()) { setErrMsg('יש להזין מספר קופה'); return }

    setLoading(true)
    try {
      // Find box by iron_number (search filter on backend)
      const boxes = await boxesApi.getAll({ search: ironInput.trim() })
      const box = Array.isArray(boxes)
        ? boxes.find(b => b.iron_number === ironInput.trim()) || boxes[0]
        : null
      if (!box) { setErrMsg(`לא נמצאה קופה ${ironInput}`); setLoaded(true); setBoxInfo(null); setEnvs([]); return }

      // Fetch the active card (or most recent) for this box
      const cards = await cardsApi.getAll({ box_id: box.id })
      const list = Array.isArray(cards) ? cards : []
      const card = list.find(c => c.status === 'active') || list[0] || null

      setBoxInfo(box)
      setCardInfo(card)

      // Envelopes for the active card, filtered by date if provided
      if (card) {
        const filters = { card_id: card.id }
        if (fromVal) filters.from = fromVal
        if (toVal)   filters.to   = toVal
        const data = await envelopesApi.getAll(filters)
        const arr = Array.isArray(data) ? data : []
        // sort newest-first
        arr.sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at))
        setEnvs(arr)
      } else {
        setEnvs([])
      }
      setLoaded(true)
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בהפקת הדוח')
    } finally {
      setLoading(false)
    }
  }

  const totals = useMemo(() => {
    let total = 0, count = 0
    for (const e of envs) {
      if (e.amount != null) { total += Number(e.amount) || 0; count++ }
    }
    return { total, count }
  }, [envs])

  return (
    <div>
      <div className="filters-row">
        <div className="field grow">
          <label>מספר קופה</label>
          <input
            value={ironInput}
            onChange={(e) => setIronInput(e.target.value)}
            placeholder="הזן מספר קופה"
            onKeyDown={(e) => { if (e.key === 'Enter') generate() }}
          />
        </div>
        <div className="field">
          <label>מתאריך</label>
          <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} />
        </div>
        <div className="field">
          <label>עד תאריך</label>
          <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} />
        </div>
        <button className="btn primary" onClick={generate} disabled={loading}>
          {loading ? 'מפיק...' : 'הפק'}
        </button>
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}

      {loaded && boxInfo && (
        <div className="panel">
          <div className="panel-title">
            קופה {boxInfo.iron_number}
            {cardInfo
              ? <> | {cardInfo.city || ''}{cardInfo.street ? ` · ${cardInfo.street}` : ''}</>
              : <span style={{ color: 'var(--text3)' }}> · אין כרטסת פעילה</span>}
          </div>

          <div className="stats-row stats-3" style={{ marginBottom: 14 }}>
            <div className="stat-card">
              <div className="val">{formatMoney(totals.total)}</div>
              <div className="lbl">סה"כ גביה (הוזן)</div>
            </div>
            <div className="stat-card">
              <div className="val">{totals.count}</div>
              <div className="lbl">מעטפות שהוזנו</div>
            </div>
            <div className="stat-card">
              <div className="val">{envs.length}</div>
              <div className="lbl">סה"כ מעטפות</div>
            </div>
          </div>

          {envs.length === 0 ? (
            <div className="empty">אין מעטפות בטווח שנבחר</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>מעטפה</th>
                    <th>סכום</th>
                    <th>גובה</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {envs.map(e => (
                    <tr key={e.id}>
                      <td>{formatDate(e.collected_at)}</td>
                      <td><strong>{e.envelope_number}</strong></td>
                      <td>{e.amount != null ? formatMoney(e.amount) : <span style={{ color: 'var(--text3)' }}>ממתין</span>}</td>
                      <td>{e.collector_name || '—'}</td>
                      <td>
                        {e.status === 'entered'
                          ? <span className="pill green">הוזן</span>
                          : <span className="pill yellow">ממתין</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loaded && !loading && (
        <div className="alert info">💡 הזן מספר קופה ולחץ "הפק" כדי לראות את היסטוריית הגביות שלה</div>
      )}
    </div>
  )
}

// =============================================================================
// === Tab 3: השוואה ===========================================================
// =============================================================================
// Dynamic columns — each column fetches independently via perBox endpoint
function CompareTab({ exportRef }) {
  const today = new Date()
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  let nextId = 1

  function defaultCol(num) {
    return {
      id: nextId++,
      num,
      period: 'month',
      monthVal: num === 1 ? defaultMonth : `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      yearVal: String(today.getFullYear() - (num - 1)),
      fromVal: '',
      toVal: '',
      city: '',
      neighborhood: '',
      collectorName: '',
      boxTypeId: '',
      ironNumber: '',
      customName: '',
      receiptFilter: '',
      rows: [],
      loaded: false,
      loading: false,
      errMsg: null,
    }
  }

  const [columns, setColumns] = useState([defaultCol(1), defaultCol(2)])

  function addColumn() {
    setColumns(prev => {
      const newNum = prev.length + 1
      return [...prev, defaultCol(newNum)]
    })
  }

  function removeColumn(id) {
    if (columns.length === 1) return
    setColumns(prev => prev.filter(c => c.id !== id))
  }

  function updateColumn(id, key, value) {
    setColumns(prev =>
      prev.map(c => {
        if (c.id !== id) return c
        const next = { ...c, [key]: value }
        // reset neighborhood when city changes (it's city-dependent)
        if (key === 'city') next.neighborhood = ''
        return next
      })
    )
  }

  async function generateForColumn(id) {
    const col = columns.find(c => c.id === id)
    if (!col) return

    const range = periodToRange(col.period, col.monthVal, col.yearVal, col.fromVal, col.toVal)
    if (!range.from || !range.to) {
      updateColumn(id, 'errMsg', 'יש להגדיר תקופה תקפה')
      return
    }

    updateColumn(id, 'loading', true)
    updateColumn(id, 'errMsg', null)
    try {
      const data = await reportsExportApi.perBox({
        from: range.from,
        to: range.to,
        city: col.city || undefined,
        custom_name: col.customName.trim() || undefined,
        receipt_required:
          col.receiptFilter === 'yes' ? 'true'
          : col.receiptFilter === 'no' ? 'false'
          : undefined,
      })
      let arr = Array.isArray(data) ? data : []
      // client-side filters (server only filters by city)
      if (col.neighborhood)  arr = arr.filter(r => r.neighborhood === col.neighborhood)
      if (col.collectorName) arr = arr.filter(r => r.collector_name === col.collectorName)
      if (col.boxTypeId)     arr = arr.filter(r => String(r.box_type_id) === String(col.boxTypeId))
      if (col.ironNumber)    arr = arr.filter(r => String(r.iron_number) === col.ironNumber.trim())
      updateColumn(id, 'rows', arr)
      updateColumn(id, 'loaded', true)
    } catch (err) {
      updateColumn(id, 'errMsg', err.message || 'שגיאה בהפקת הדוח')
    } finally {
      updateColumn(id, 'loading', false)
    }
  }

  function calcStats(rows) {
    const total = rows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0)
    const envelopes = rows.reduce((sum, r) => sum + (Number(r.collection_count) || 0), 0)
    const avg = rows.length ? Math.round(total / rows.length) : 0
    return { total, envelopes, avg }
  }

  const [cities, setCities] = useState([])
  const [neighborhoodsByCity, setNeighborhoodsByCity] = useState({})
  const [collectors, setCollectors] = useState([])
  const [boxTypes, setBoxTypes] = useState([])
  useEffect(() => {
    cardsApi.getAll().then(d => {
      const arr = Array.isArray(d) ? d : []
      const cs = new Set()
      const nbMap = {}
      const cmap = new Map()
      arr.forEach(c => {
        if (c.city) cs.add(c.city)
        if (c.city && c.neighborhood) {
          if (!nbMap[c.city]) nbMap[c.city] = new Set()
          nbMap[c.city].add(c.neighborhood)
        }
        if (c.collector_id && c.collector_name) cmap.set(c.collector_id, c.collector_name)
      })
      setCities(Array.from(cs).sort((a, b) => a.localeCompare(b, 'he')))
      setNeighborhoodsByCity(Object.fromEntries(
        Object.entries(nbMap).map(([k, v]) => [k, Array.from(v).sort((a, b) => a.localeCompare(b, 'he'))])
      ))
      setCollectors(Array.from(cmap.values()).sort((a, b) => a.localeCompare(b, 'he')))
    }).catch(() => {})
    boxTypesApi.getAll().then(d => {
      setBoxTypes(Array.isArray(d) ? d : [])
    }).catch(() => {})
  }, [])

  // Per-column summary export. Rows = metrics, columns = each compare-column,
  // plus diff and % between adjacent columns.
  function exportCompare() {
    const loadedCols = columns.filter(c => c.loaded)
    if (loadedCols.length === 0) {
      alert('יש להפיק לפחות עמודה אחת לפני יצוא')
      return
    }

    const colStats = loadedCols.map((col, idx) => {
      const range = periodToRange(col.period, col.monthVal, col.yearVal, col.fromVal, col.toVal)
      const periodLabel = range.from && range.to ? `${range.from} → ${range.to}` : ''
      const parts = []
      if (col.city)          parts.push(col.city)
      if (col.neighborhood)  parts.push(col.neighborhood)
      if (col.collectorName) parts.push(col.collectorName)
      if (col.boxTypeId) {
        const bt = boxTypes.find(b => String(b.id) === String(col.boxTypeId))
        if (bt) parts.push(bt.name)
      }
      if (col.ironNumber)    parts.push(`קופה ${col.ironNumber}`)
      if (col.customName)    parts.push(`שם: ${col.customName.trim()}`)
      if (col.receiptFilter === 'yes') parts.push('עם קבלה')
      else if (col.receiptFilter === 'no') parts.push('ללא קבלה')
      const label = `עמודה ${idx + 1}`
        + (periodLabel ? ` (${periodLabel})` : '')
        + (parts.length ? ` — ${parts.join(', ')}` : '')
      const s = calcStats(col.rows)
      return { label, total: s.total, envelopes: s.envelopes, avg: s.avg, boxes: col.rows.length }
    })

    const metrics = [
      { key: 'total',     label: 'סה"כ גביה' },
      { key: 'envelopes', label: 'מעטפות' },
      { key: 'avg',       label: 'ממוצע לקופה' },
      { key: 'boxes',     label: 'מס׳ קופות' },
    ]

    const rows = metrics.map(m => {
      const row = { metric: m.label }
      colStats.forEach((cs, idx) => {
        row[`c${idx + 1}`] = cs[m.key]
      })
      for (let i = 1; i < colStats.length; i++) {
        const a = colStats[i - 1][m.key]
        const b = colStats[i][m.key]
        row[`d${i}`] = b - a
        row[`p${i}`] = a ? Math.round(((b - a) / a) * 100) : ''
      }
      return row
    })

    const cols = [{ key: 'metric', label: 'מדד' }]
    colStats.forEach((cs, idx) => {
      cols.push({ key: `c${idx + 1}`, label: cs.label })
    })
    for (let i = 1; i < colStats.length; i++) {
      cols.push({ key: `d${i}`, label: `הפרש ${i + 1}↔${i}` })
      cols.push({ key: `p${i}`, label: `% ${i + 1}↔${i}` })
    }

    exportCsv(rows, cols, csvFilename('compare'))
  }

  // Expose exportCompare to the page-header button via shared ref.
  // Re-bind whenever columns change so the closure sees fresh data.
  useEffect(() => {
    if (!exportRef) return
    exportRef.current = exportCompare
    return () => { exportRef.current = null }
  }, [columns, exportRef])

  return (
    <div>
      <div className="alert info" style={{ marginBottom: 16 }}>
        💡 כל עמודה היא פילטר עצמאי — בחר תקופה + עיר (אופציונלי). לחץ הפק בכל עמודה. לחץ ＋ להוספת עמודה ללא הגבלה.
      </div>

      <div className="compare-cols" id="compare-cols">
        {columns.map((col, idx) => {
          const stats = col.loaded ? calcStats(col.rows) : null
          return (
            <div key={col.id} className="compare-col">
              <div className="col-header">
                <span>עמודה {idx + 1}</span>
                {columns.length > 1 && (
                  <button
                    onClick={() => removeColumn(col.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}
                  >✕</button>
                )}
              </div>

              <div className="field" style={{ marginBottom: 6 }}>
                <label>תקופה</label>
                <select
                  value={col.period}
                  onChange={(e) => updateColumn(col.id, 'period', e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="month">חודשי</option>
                  <option value="year">שנתי</option>
                  <option value="range">טווח</option>
                </select>
              </div>

              {col.period === 'month' && (
                <div className="field" style={{ marginBottom: 6 }}>
                  <label>חודש / שנה</label>
                  <MonthYearPicker
                    value={col.monthVal}
                    onChange={(v) => updateColumn(col.id, 'monthVal', v)}
                    selectStyle={{ fontSize: 13 }}
                  />
                </div>
              )}
              {col.period === 'year' && (
                <div className="field" style={{ marginBottom: 6 }}>
                  <label>שנה</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={col.yearVal}
                    onChange={(e) => updateColumn(col.id, 'yearVal', e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
              )}
              {col.period === 'range' && (
                <>
                  <div className="field" style={{ marginBottom: 6 }}>
                    <label>מתאריך</label>
                    <input
                      type="date"
                      value={col.fromVal}
                      onChange={(e) => updateColumn(col.id, 'fromVal', e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 6 }}>
                    <label>עד תאריך</label>
                    <input
                      type="date"
                      value={col.toVal}
                      onChange={(e) => updateColumn(col.id, 'toVal', e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </>
              )}

              <div className="field" style={{ marginBottom: 6 }}>
                <label>עיר</label>
                <select
                  value={col.city}
                  onChange={(e) => updateColumn(col.id, 'city', e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">כל הערים</option>
                  {cities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 6 }}>
                <label>שכונה</label>
                <select
                  value={col.neighborhood}
                  onChange={(e) => updateColumn(col.id, 'neighborhood', e.target.value)}
                  style={{ fontSize: 13 }}
                  disabled={!col.city}
                >
                  <option value="">כל השכונות</option>
                  {(neighborhoodsByCity[col.city] || []).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 6 }}>
                <label>גובה</label>
                <select
                  value={col.collectorName}
                  onChange={(e) => updateColumn(col.id, 'collectorName', e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">כל הגובים</option>
                  {collectors.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 6 }}>
                <label>סוג קופה</label>
                <select
                  value={col.boxTypeId}
                  onChange={(e) => updateColumn(col.id, 'boxTypeId', e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">כל הסוגים</option>
                  {boxTypes.map(bt => (
                    <option key={bt.id} value={bt.id}>{bt.name}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 6 }}>
                <label>קופה ספציפית</label>
                <input
                  value={col.ironNumber}
                  onChange={(e) => updateColumn(col.id, 'ironNumber', e.target.value)}
                  placeholder="מספר קופה (אופציונלי)"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div className="field" style={{ marginBottom: 6 }}>
                <label>שם מותאם</label>
                <input
                  value={col.customName}
                  onChange={(e) => updateColumn(col.id, 'customName', e.target.value)}
                  placeholder="חיפוש חלקי"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label>מעוניין בקבלה</label>
                <select
                  value={col.receiptFilter}
                  onChange={(e) => updateColumn(col.id, 'receiptFilter', e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">הכל</option>
                  <option value="yes">כן</option>
                  <option value="no">לא</option>
                </select>
              </div>

              <button
                className="btn primary"
                onClick={() => generateForColumn(col.id)}
                disabled={col.loading}
                style={{ width: '100%', marginBottom: 10 }}
              >
                {col.loading ? 'מפיק...' : 'הפק'}
              </button>

              {col.errMsg && <div className="alert red" style={{ fontSize: 12, marginBottom: 10 }}>{col.errMsg}</div>}

              {col.loaded && stats && (
                <>
                  <div className="col-val">{formatMoney(stats.total)}</div>
                  <div className="col-lbl">סה"כ גביה</div>
                  <div className="col-val" style={{ fontSize: 16 }}>{stats.envelopes}</div>
                  <div className="col-lbl">מעטפות</div>
                  <div className="col-val" style={{ fontSize: 16 }}>{formatMoney(stats.avg)}</div>
                  <div className="col-lbl">ממוצע לקופה</div>
                </>
              )}
            </div>
          )
        })}

        <div className="add-compare-col" onClick={addColumn}>
          <div style={{ fontSize: 28 }}>＋</div>
          <div>הוסף עמודה</div>
          <div style={{ fontSize: 11, textAlign: 'center', color: 'var(--text3)' }}>תקופה + עיר</div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="btn sm" onClick={exportCompare}>📥 יצוא לאקסל</button>
      </div>
    </div>
  )
}

// =============================================================================
// === Page wrapper ============================================================
// =============================================================================
export default function DochotPage() {
  const [tab, setTab] = useState('summary')
  const compareExportRef = useRef(null)

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">דוחות</div>
          <div className="page-subtitle">דוחות גביה — סיכומים, פירוט לפי קופה, השוואות</div>
        </div>
        {tab === 'compare' && (
          <button
            className="btn sm"
            onClick={() => compareExportRef.current && compareExportRef.current()}
          >📥 יצוא לאקסל</button>
        )}
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={'tab-btn' + (tab === t.key ? ' active' : '')}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'perbox'  && <PerBoxTab />}
      {tab === 'compare' && <CompareTab exportRef={compareExportRef} />}
    </div>
  )
}
