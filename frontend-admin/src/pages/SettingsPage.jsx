import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  settings as settingsApi,
  taskTypes as taskTypesApi,
  reportTypes as reportTypesApi,
  boxTypes as boxTypesApi,
  cities as citiesApi,
  cards as cardsApi,
} from '../api/endpoints'
import TaskTypeModal from '../components/TaskTypeModal'
import ReportTypeModal from '../components/ReportTypeModal'
import BoxTypeModal from '../components/BoxTypeModal'
import CityModal from '../components/CityModal'

const ITEM_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderBottom: '1px solid var(--border, #eef0f3)',
}

const LOGIC_TAG_BASE = {
  display: 'inline-block',
  padding: '2px 8px',
  marginInlineEnd: 4,
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
}

function LogicTag({ kind, children }) {
  const colors = {
    open:  { bg: 'var(--green-soft, #dcfce7)', color: 'var(--green, #16a34a)' },
    close: { bg: 'var(--red-soft, #fee2e2)',   color: 'var(--red, #dc2626)' },
    none:  { bg: 'var(--bg2, #f3f4f6)',        color: 'var(--text2, #6b7280)' },
  }
  const c = colors[kind] || colors.none
  return (
    <span style={{ ...LOGIC_TAG_BASE, background: c.bg, color: c.color }}>
      {children}
    </span>
  )
}

function describeTaskLogic(t) {
  if (t.opens_card && t.closes_card) {
    return [<LogicTag key="c" kind="close">סגירת כרטסת</LogicTag>,
            <LogicTag key="o" kind="open">פתיחת כרטסת</LogicTag>]
  }
  if (t.opens_card)  return [<LogicTag key="o" kind="open">פתיחת כרטסת</LogicTag>]
  if (t.closes_card) return [<LogicTag key="c" kind="close">סגירת כרטסת</LogicTag>]
  return [<LogicTag key="n" kind="none">ללא פעולת כרטסת</LogicTag>]
}

export default function SettingsPage() {
  // Global settings
  const [alertDays, setAlertDays] = useState('30')
  const [origAlertDays, setOrigAlertDays] = useState('30')
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [globalMsg, setGlobalMsg] = useState(null)

  // Geocoding (task 61)
  const [geocodingRunning, setGeocodingRunning] = useState(false)
  const [geocodingResult, setGeocodingResult]   = useState(null) // { attempted, ok, neighborhood_center, not_found, error } or { error }
  const [geocodeCity, setGeocodeCity]           = useState('')   // '' = all cities; otherwise scope to this city
  const [geocodeProgress, setGeocodeProgress]   = useState(null) // { done, total } while running, null otherwise
  const [geocodeRetryNotFound, setGeocodeRetryNotFound] = useState(false) // include sticky 'not_found' on retry
  // Street-rename groups: key=`${city}|${street}`, value={ newStreet, applying, lastResult }
  // `lastResult` is { ok, failed: [{ id, iron_number, returned_address }] }
  const [renameState, setRenameState]           = useState({})

  // Google Maps API key (task 62) — sensitive, stored in settings table only.
  const [apiKeySet, setApiKeySet]   = useState(false)   // does the server have a key?
  const [apiKeyInput, setApiKeyInput] = useState('')    // new value the admin is typing
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeyMsg, setApiKeyMsg] = useState(null)

  // Type lists (null = loading, [] = empty)
  const [taskList, setTaskList] = useState(null)
  const [reportList, setReportList] = useState(null)
  const [boxList, setBoxList] = useState(null)
  const [cityList, setCityList] = useState(null)
  const [unassignedCities, setUnassignedCities] = useState([])

  // Modal state — { which, item, prefillName? } where item===null means create
  const [modal, setModal] = useState(null)

  const [citiesOpen, setCitiesOpen] = useState(false)
  function openModal(which, item = null, extra = {}) { setModal({ which, item, ...extra }) }
  function closeModal() { setModal(null) }

  // Refresh the unassigned-cities banner. Called on initial load and after
  // any city create/update/delete so it stays in sync.
  function refreshUnassigned() {
    citiesApi.unassigned()
      .then(list => setUnassignedCities(Array.isArray(list) ? list : []))
      .catch(() => setUnassignedCities([]))
  }

  // Helpers to upsert / remove items inside a list
  function upsert(setter, saved) {
    setter(prev => {
      const list = Array.isArray(prev) ? prev : []
      const idx = list.findIndex(t => t.id === saved.id)
      if (idx >= 0) {
        const next = list.slice(); next[idx] = { ...list[idx], ...saved }
        return next
      }
      return [...list, saved]
    })
  }
  function removeById(setter, id) {
    setter(prev => (Array.isArray(prev) ? prev.filter(t => t.id !== id) : prev))
  }

  // Direct row-level delete for a lookup type (task / report). The backend
  // blocks (409) a type still referenced by existing tasks/reports and returns
  // an explanatory message that we surface as-is.
  async function handleTypeDelete(api, setter, item) {
    if (!window.confirm(`למחוק את "${item.name}"?`)) return
    try {
      await api.remove(item.id)
      removeById(setter, item.id)
    } catch (err) {
      alert(err.message || 'שגיאה במחיקה')
    }
  }

  // Initial load
  useEffect(() => {
    let cancelled = false
    settingsApi.getAll().then(s => {
      if (cancelled) return
      const v = s?.alert_days_global ?? '30'
      setAlertDays(String(v))
      setOrigAlertDays(String(v))
      setApiKeySet(!!s?.google_maps_api_key_set)
    }).catch(() => {})

    taskTypesApi.getAll().then(d => !cancelled && setTaskList(Array.isArray(d) ? d : [])).catch(() => !cancelled && setTaskList([]))
    reportTypesApi.getAll().then(d => !cancelled && setReportList(Array.isArray(d) ? d : [])).catch(() => !cancelled && setReportList([]))
    boxTypesApi.getAll().then(d => !cancelled && setBoxList(Array.isArray(d) ? d : [])).catch(() => !cancelled && setBoxList([]))
    citiesApi.getAll().then(d => !cancelled && setCityList(Array.isArray(d) ? d : [])).catch(() => !cancelled && setCityList([]))
    citiesApi.unassigned().then(d => !cancelled && setUnassignedCities(Array.isArray(d) ? d : [])).catch(() => !cancelled && setUnassignedCities([]))

    return () => { cancelled = true }
  }, [])

  async function saveGlobal() {
    setGlobalMsg(null)
    const n = Number.parseInt(alertDays, 10)
    if (!Number.isInteger(n) || n < 1 || n > 3650) {
      setGlobalMsg({ type: 'red', text: 'יש להזין מספר שלם בין 1 ל-3650' })
      return
    }
    setSavingGlobal(true)
    try {
      const res = await settingsApi.update('alert_days_global', n)
      const v = String(res?.alert_days_global ?? n)
      setAlertDays(v)
      setOrigAlertDays(v)
      setGlobalMsg({ type: 'green', text: 'נשמר בהצלחה' })
      setTimeout(() => setGlobalMsg(null), 3000)
    } catch (err) {
      setGlobalMsg({ type: 'red', text: err.message || 'שגיאה בשמירה' })
    } finally {
      setSavingGlobal(false)
    }
  }

  async function saveApiKey() {
    setApiKeyMsg(null)
    setApiKeySaving(true)
    try {
      const res = await settingsApi.update('google_maps_api_key', apiKeyInput)
      setApiKeySet(!!res?.google_maps_api_key_set)
      setApiKeyInput('')
      setApiKeyMsg({ type: 'green', text: apiKeyInput ? 'המפתח נשמר.' : 'המפתח הוסר.' })
      setTimeout(() => setApiKeyMsg(null), 3000)
    } catch (err) {
      setApiKeyMsg({ type: 'red', text: err.message || 'שגיאה בשמירת המפתח' })
    } finally {
      setApiKeySaving(false)
    }
  }

  async function clearApiKey() {
    setApiKeyMsg(null)
    setApiKeySaving(true)
    try {
      const res = await settingsApi.update('google_maps_api_key', '')
      setApiKeySet(!!res?.google_maps_api_key_set)
      setApiKeyMsg({ type: 'green', text: 'המפתח הוסר.' })
      setTimeout(() => setApiKeyMsg(null), 3000)
    } catch (err) {
      setApiKeyMsg({ type: 'red', text: err.message || 'שגיאה בהסרת המפתח' })
    } finally {
      setApiKeySaving(false)
    }
  }

  // Client-driven batch: one card per HTTP request, so a long run never holds
  // a single connection open and the UI can show real progress. Mirrors the
  // legacy server-side `geocodeMissing` semantics (auto-approve on success).
  //
  // By default cards already stuck at 'not_found' are skipped (retrying the
  // same address won't help — the admin is expected to fix the street name via
  // the rename panel, or pin manually). The "כולל ניסיון חוזר..." checkbox
  // forces those cards back into the loop.
  async function runGeocodeMissing() {
    if (geocodingRunning) return
    setGeocodingResult(null)
    setGeocodeProgress(null)
    setRenameState({})
    setGeocodingRunning(true)
    try {
      const pending = await cardsApi.geocodePending(geocodeCity || undefined, {
        includeNotFound: geocodeRetryNotFound,
      })
      const list = Array.isArray(pending) ? pending : []
      const stats = { attempted: 0, ok: 0, neighborhood_center: 0, not_found: 0, error: 0, disabled: 0 }
      for (let i = 0; i < list.length; i++) {
        const card = list[i]
        setGeocodeProgress({ done: i, total: list.length })
        try {
          const r = await cardsApi.geocode(card.id, { autoApprove: true })
          stats.attempted += 1
          if      (r?.status === 'ok')                  stats.ok += 1
          else if (r?.status === 'neighborhood_center') stats.neighborhood_center += 1
          else if (r?.status === 'not_found')           stats.not_found += 1
          else if (r?.status === 'disabled')            stats.disabled += 1
          else                                          stats.error += 1
        } catch {
          stats.attempted += 1
          stats.error += 1
        }
      }
      setGeocodeProgress({ done: list.length, total: list.length })
      // Pull the full not_found backlog so the rename panel covers ALL stuck
      // cards in scope, not just the ones we just attempted. This is what makes
      // re-runs idempotent — the admin keeps seeing what's left to fix.
      try {
        const backlog = await cardsApi.geocodeNotFound(geocodeCity || undefined)
        stats.not_found_cards = Array.isArray(backlog) ? backlog : []
      } catch {
        stats.not_found_cards = []
      }
      setGeocodingResult(stats)
    } catch (err) {
      setGeocodingResult({ error: err.message || 'שגיאה בהרצת הגיאוקודינג' })
    } finally {
      setGeocodingRunning(false)
    }
  }

  // Group not_found_cards by (city|street) so the admin can fix a typo once
  // and apply it to every card on that street in one click.
  const renameGroups = useMemo(() => {
    const cards = Array.isArray(geocodingResult?.not_found_cards) ? geocodingResult.not_found_cards : []
    const map = new Map()
    for (const c of cards) {
      const street = (c.street || '').trim()
      if (!street) continue
      const cityKey = (c.city || '').trim()
      const key = `${cityKey}|${street}`
      if (!map.has(key)) map.set(key, { key, city: cityKey, street, cards: [] })
      map.get(key).cards.push(c)
    }
    return Array.from(map.values()).sort((a, b) => b.cards.length - a.cards.length)
  }, [geocodingResult])

  function setRenameField(key, patch) {
    setRenameState(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }))
  }

  async function applyStreetRename(group) {
    const st = renameState[group.key] || {}
    if (st.applying) return
    const newStreet = (st.newStreet || '').trim()
    if (!newStreet) return
    setRenameField(group.key, { applying: true, lastResult: null })
    try {
      const cardIds = group.cards.map(c => c.id)
      const { results } = await cardsApi.retryStreetRename(cardIds, newStreet)
      const okIds = new Set()
      const failed = []
      for (const r of (results || [])) {
        if (r.status === 'ok') okIds.add(r.id)
        else {
          const card = group.cards.find(c => c.id === r.id)
          failed.push({
            id: r.id,
            iron_number: card?.iron_number,
            returned_address: r.returned_address,
            status: r.status,
          })
        }
      }
      // Drop the successfully-renamed cards from the not_found list so the
      // group either shrinks or disappears.
      setGeocodingResult(prev => {
        if (!prev || !Array.isArray(prev.not_found_cards)) return prev
        const remaining = prev.not_found_cards.filter(c => !okIds.has(c.id))
        return {
          ...prev,
          ok: (prev.ok || 0) + okIds.size,
          not_found: (prev.not_found || 0) - okIds.size,
          not_found_cards: remaining,
        }
      })
      setRenameField(group.key, {
        applying: false,
        lastResult: { ok: okIds.size, failed },
      })
    } catch (err) {
      setRenameField(group.key, {
        applying: false,
        lastResult: { ok: 0, failed: [], error: err.message || 'שגיאה בהחלת התיקון' },
      })
    }
  }

  const isDirty = String(alertDays) !== String(origAlertDays)

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">הגדרות</div>
          <div className="page-subtitle">סוגים ופרמטרים גלובליים של המערכת</div>
        </div>
      </div>

      {unassignedCities.length > 0 && (
        <div className="alert" style={{
          background: 'var(--yellow-soft, #fef3c7)',
          color: 'var(--yellow, #92400e)',
          border: '1px solid var(--yellow, #fcd34d)',
          padding: 12, borderRadius: 8, marginBottom: 16,
        }}>
          ⚠️ נמצאו {unassignedCities.length} ערים בכרטסות שאינן בטבלת הערים.
          ‎שיוך גובה למחוז לא יכלול אותן עד שתוסיפו אותן ותשייכו למחוז:
          <div style={{ marginTop: 6 }}>
            {unassignedCities.map(name => (
              <span key={name} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', marginInlineEnd: 6, marginBottom: 6,
                background: 'var(--surface, #fff)',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 14, fontSize: 12, cursor: 'pointer',
              }}
                onClick={() => openModal('city', null, { prefillName: name })}
                title="הוספה למילון הערים"
              >
                {name} <span style={{ color: 'var(--text3)' }}>+</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* === BULK IMPORT LINKS === */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">ייבוא קופות מאקסל</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
          העלאת קובץ .xlsx ליצירת קופה + כרטסת ראשונה לכל שורה.
          ניתן לערוך שורות בעייתיות ישירות בתצוגה המקדימה לפני ביצוע הייבוא.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/import-boxes" className="btn btn-secondary">
            📥 ייבוא בסיסי (8 עמודות)
          </Link>
          <Link to="/import-boxes-v2" className="btn btn-secondary">
            📥 ייבוא מורחב (11 עמודות, עם שם מותאם / התראה / קבלה)
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>

        {/* === TASK TYPES === */}
        <div className="panel">
          <div className="panel-title">סוגי משימות</div>
          {taskList === null ? (
            <div className="loading"><div className="spinner" /><span>טוען...</span></div>
          ) : taskList.length === 0 ? (
            <div className="empty">אין סוגי משימות להצגה</div>
          ) : (
            taskList.map(t => (
              <div key={t.id} style={ITEM_ROW_STYLE}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {t.icon ? `${t.icon} ` : ''}{t.name}
                  </div>
                  <div style={{ marginTop: 4 }}>{describeTaskLogic(t)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn sm"
                    onClick={() => openModal('task', t)}
                  >עריכה</button>
                  <button
                    className="btn sm"
                    style={{ color: 'var(--red)' }}
                    onClick={() => handleTypeDelete(taskTypesApi, setTaskList, t)}
                  >מחיקה</button>
                </div>
              </div>
            ))
          )}
          <button
            className="btn sm"
            style={{ marginTop: 12 }}
            onClick={() => openModal('task')}
          >+ הוספת סוג משימה</button>
        </div>

        {/* === REPORT TYPES === */}
        <div className="panel">
          <div className="panel-title">סוגי דיווחים</div>
          {reportList === null ? (
            <div className="loading"><div className="spinner" /><span>טוען...</span></div>
          ) : reportList.length === 0 ? (
            <div className="empty">אין סוגי דיווחים להצגה</div>
          ) : (
            reportList.map(t => (
              <div key={t.id} style={ITEM_ROW_STYLE}>
                <div style={{ fontWeight: 600 }}>
                  {t.icon ? `${t.icon} ` : ''}{t.name}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn sm"
                    onClick={() => openModal('report', t)}
                  >עריכה</button>
                  <button
                    className="btn sm"
                    style={{ color: 'var(--red)' }}
                    onClick={() => handleTypeDelete(reportTypesApi, setReportList, t)}
                  >מחיקה</button>
                </div>
              </div>
            ))
          )}
          <button
            className="btn sm"
            style={{ marginTop: 12 }}
            onClick={() => openModal('report')}
          >+ הוספת סוג דיווח</button>
        </div>

        {/* === BOX TYPES === */}
        <div className="panel">
          <div className="panel-title">סוגי קופות</div>
          {boxList === null ? (
            <div className="loading"><div className="spinner" /><span>טוען...</span></div>
          ) : boxList.length === 0 ? (
            <div className="empty">אין סוגי קופות להצגה</div>
          ) : (
            boxList.map(t => {
              const kindLabel = t.kind === 'shop'  ? 'חנות'
                              : t.kind === 'other' ? 'אחר'
                              : 'רחוב'
              const kindColor = t.kind === 'shop'  ? 'var(--yellow, #b45309)'
                              : t.kind === 'other' ? 'var(--text3)'
                              : 'var(--green, #15803d)'
              return (
                <div key={t.id} style={ITEM_ROW_STYLE}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{t.name}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: 'var(--bg2, rgba(0,0,0,0.05))',
                      color: kindColor,
                    }}>{kindLabel}</span>
                  </div>
                  <button
                    className="btn sm"
                    onClick={() => openModal('box', t)}
                  >עריכה</button>
                </div>
              )
            })
          )}
          <button
            className="btn sm"
            style={{ marginTop: 12 }}
            onClick={() => openModal('box')}
          >+ הוספה</button>
        </div>

        {/* === GEOCODING / MAP === */}
        <div className="panel">
          <div className="panel-title">מפה וגיאוקודינג</div>

          {/* Google Maps API key (task 62) — sensitive, never echoed back. */}
          <div className="field" style={{ marginBottom: 14 }}>
            <label>
              מפתח Google Maps API
              {apiKeySet
                ? <span className="pill green" style={{ marginInlineStart: 8, padding: '2px 8px', fontSize: 11 }}>✓ הוגדר</span>
                : <span className="pill" style={{ marginInlineStart: 8, padding: '2px 8px', fontSize: 11, background: 'var(--bg2, #f3f4f6)', color: 'var(--text2, #6b7280)' }}>לא הוגדר</span>}
            </label>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
              נדרש להפעלת תרגום כתובות ולהצגת המפה. הקוד מגביל את החיפוש לעיר שנבחרה
              בכרטסת כדי שגוגל לא יבחר רחוב בעיר שכנה. יש להפעיל ב-Google Cloud:
              Maps JavaScript API + Geocoding API.
            </div>
            <input
              type="password"
              autoComplete="new-password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={apiKeySet ? '••••••••  (הזן ערך חדש כדי להחליף)' : 'הזן את מפתח ה-API'}
              disabled={apiKeySaving}
            />
            {apiKeyMsg && (
              <div className={'alert ' + apiKeyMsg.type} style={{ marginTop: 8 }}>
                {apiKeyMsg.text}
              </div>
            )}
            <div className="actions" style={{ marginTop: 8 }}>
              <button
                className="btn primary sm"
                onClick={saveApiKey}
                disabled={apiKeySaving || !apiKeyInput.trim()}
              >
                {apiKeySaving ? 'שומר...' : 'שמירת מפתח'}
              </button>
              {apiKeySet && (
                <button
                  className="btn sm danger"
                  onClick={clearApiKey}
                  disabled={apiKeySaving}
                  style={{ marginInlineStart: 8 }}
                >
                  הסר מפתח
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            מתרגם כתובות של קופות פעילות לקואורדינטות (לתצוגה על המפה ולאימות GPS של גובים).
            החיפוש מוגבל לעיר שהוזנה בכרטסת — אם הרחוב לא קיים בעיר הזו, התוצאה נדחית
            במקום להחזיר רחוב מעיר שכנה.
            כל תוצאה מוצלחת מסומנת אוטומטית כמאושרת — בסיום ההרצה תוצג רשימה של
            הכרטסות שגוגל לא מצא, כדי שתוכלי להיכנס לכל אחת ולמקם את הסיכה ידנית.
          </div>

          {geocodingResult && !geocodingResult.error && (
            <div className="alert green" style={{ marginBottom: 10 }}>
              הסתיים. נסיונות: {geocodingResult.attempted} | הצליחו ואושרו אוטומטית: {geocodingResult.ok} |
              מרכז שכונה (דורש אישור ידני): {geocodingResult.neighborhood_center || 0} |
              לא נמצאו: {geocodingResult.not_found} | שגיאות: {geocodingResult.error}
              {geocodingResult.disabled ? ` | מושבת: ${geocodingResult.disabled}` : ''}
            </div>
          )}
          {geocodingResult?.error && (
            <div className="alert red" style={{ marginBottom: 10 }}>
              {geocodingResult.error}
            </div>
          )}

          {renameGroups.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                תיקון שם רחוב — קבוצות שלא נמצאו ({renameGroups.length}):
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                במקום ללכת לכל כרטסת, הזיני שם רחוב מתוקן (למשל "הרב כהנמן" במקום "השומר") —
                המערכת תנסה לאתר אותו מחדש ותעדכן את כל הכרטסות בקבוצה זו. כרטסות שגוגל
                עדיין לא מוצא יישארו ברשימה למטה.
              </div>
              <div style={{
                border: '1px solid var(--border, #eef0f3)',
                borderRadius: 6,
                maxHeight: 320,
                overflowY: 'auto',
              }}>
                {renameGroups.map(g => {
                  const st = renameState[g.key] || {}
                  const value = st.newStreet ?? ''
                  const last = st.lastResult
                  return (
                    <div key={g.key} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #eef0f3)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span style={{ minWidth: 0, flex: '1 1 auto' }}>
                          <strong>{g.street || '(ללא רחוב)'}</strong>
                          {g.city ? <span style={{ color: 'var(--text3)' }}> — {g.city}</span> : null}
                          <span style={{ color: 'var(--text3)' }}> ({g.cards.length})</span>
                        </span>
                        <input
                          type="text"
                          placeholder="שם רחוב מתוקן"
                          value={value}
                          onChange={(e) => setRenameField(g.key, { newStreet: e.target.value })}
                          disabled={!!st.applying}
                          style={{ minWidth: 180 }}
                        />
                        <button
                          className="btn sm primary"
                          disabled={!!st.applying || !value.trim()}
                          onClick={() => applyStreetRename(g)}
                        >
                          {st.applying ? `מחיל... (${g.cards.length})` : 'החל'}
                        </button>
                      </div>
                      {last && (
                        <div style={{ marginTop: 6, fontSize: 12 }}>
                          {last.error ? (
                            <span style={{ color: 'var(--red, #dc2626)' }}>{last.error}</span>
                          ) : (
                            <>
                              <span style={{ color: 'var(--green, #16a34a)' }}>
                                ✓ עודכנו {last.ok} כרטסות
                              </span>
                              {last.failed.length > 0 && (
                                <div style={{ marginTop: 4, color: 'var(--text2)' }}>
                                  <div>נכשלו {last.failed.length}:</div>
                                  <ul style={{ margin: '2px 0 0 0', paddingInlineStart: 18 }}>
                                    {last.failed.slice(0, 5).map(f => (
                                      <li key={f.id}>
                                        {f.iron_number ? <strong>{f.iron_number}</strong> : `#${f.id}`}
                                        {f.returned_address
                                          ? <> — גוגל החזיר: <em>{f.returned_address}</em></>
                                          : f.status === 'not_found'
                                            ? ' — לא נמצא'
                                            : f.status === 'disabled'
                                              ? ' — מפתח API לא מוגדר'
                                              : ' — שגיאה'}
                                      </li>
                                    ))}
                                    {last.failed.length > 5 && (
                                      <li style={{ color: 'var(--text3)' }}>
                                        ועוד {last.failed.length - 5}...
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {Array.isArray(geocodingResult?.not_found_cards) && geocodingResult.not_found_cards.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                כרטסות שגוגל לא מצא ({geocodingResult.not_found_cards.length}) — יש לפתוח כל אחת ולמקם את הסיכה ידנית במפה:
              </div>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                maxHeight: 240,
                overflowY: 'auto',
                border: '1px solid var(--border, #eef0f3)',
                borderRadius: 6,
              }}>
                {geocodingResult.not_found_cards.map((c) => {
                  const addressParts = [c.street, c.building].filter(Boolean).join(' ')
                  const regionParts = [c.neighborhood, c.city].filter(Boolean).join(', ')
                  const address = [addressParts, regionParts].filter(Boolean).join(' — ')
                  return (
                    <li key={c.id} style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid var(--border, #eef0f3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      alignItems: 'center',
                    }}>
                      <span>
                        <strong>{c.iron_number}</strong>
                        {c.custom_name ? ` (${c.custom_name})` : ''}
                        {address ? ` — ${address}` : ''}
                      </span>
                      <Link to={`/cards/${c.id}`} className="btn sm">פתח כרטסת</Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: 'var(--text2)' }}>
              סנן לפי עיר:
            </label>
            <select
              value={geocodeCity}
              onChange={(e) => setGeocodeCity(e.target.value)}
              disabled={geocodingRunning}
              style={{ minWidth: 180 }}
            >
              <option value="">כל הערים</option>
              {Array.isArray(cityList) && cityList.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <button
              className="btn primary sm"
              onClick={runGeocodeMissing}
              disabled={geocodingRunning || !apiKeySet}
              title={!apiKeySet ? 'יש להגדיר מפתח API קודם' : undefined}
            >
              {geocodingRunning
                ? (geocodeProgress
                    ? `מתרגם כתובות... ${geocodeProgress.done}/${geocodeProgress.total}`
                    : 'מתרגם כתובות...')
                : geocodeCity
                  ? `🗺️ הרץ גיאוקודינג לעיר ${geocodeCity}`
                  : '🗺️ הרץ גיאוקודינג לקופות חסרות'}
            </button>
            <label style={{ fontSize: 13, color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={geocodeRetryNotFound}
                onChange={(e) => setGeocodeRetryNotFound(e.target.checked)}
                disabled={geocodingRunning}
              />
              כולל ניסיון חוזר לכרטסות שלא נמצאו בעבר
            </label>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            ההרצה מדלגת על כרטסות שגוגל כבר אמר עליהן "לא נמצא" — אין טעם לנסות את אותה כתובת שוב.
            סמני את התיבה כדי לכפות ניסיון חוזר גם עליהן.
          </div>
        </div>

        {/* === CITIES & DISTRICTS === */}
        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <button
            type="button"
            onClick={() => setCitiesOpen(o => !o)}
            aria-expanded={citiesOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
              textAlign: 'inherit',
            }}
          >
            <span className="panel-title" style={{ margin: 0 }}>
              ערים ומחוזות
              {Array.isArray(cityList) && (
                <span style={{ color: 'var(--text3)', fontWeight: 400, marginInlineStart: 8 }}>
                  ({cityList.length})
                </span>
              )}
            </span>
            <span style={{
              display: 'inline-block',
              transition: 'transform 0.15s ease',
              transform: citiesOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              fontSize: 14,
              color: 'var(--text2)',
            }}>▶</span>
          </button>

          {citiesOpen && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                מילון ערים עם שיוך למחוז. שיוך גובה ל-"מחוז X" כולל אוטומטית את כל הערים שהוגדרו כאן עם המחוז הזה.
                שינוי המחוז של עיר משפיע מיידית על הגובים המשויכים — ללא צורך בעדכון נוסף.
              </div>
              {cityList === null ? (
                <div className="loading"><div className="spinner" /><span>טוען...</span></div>
              ) : cityList.length === 0 ? (
                <div className="empty">אין ערים מוגדרות</div>
              ) : (
                <div style={{
                  maxHeight: 360,
                  overflowY: 'auto',
                  border: '1px solid var(--border, #eef0f3)',
                  borderRadius: 6,
                  padding: '0 10px',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 16px' }}>
                    {cityList.map(c => (
                      <div key={c.id} style={ITEM_ROW_STYLE}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                            {c.district ? `מחוז: ${c.district}` : 'ללא מחוז'}
                            {c.alert_days != null && ` · התראה: ${c.alert_days} ימים`}
                          </div>
                        </div>
                        <button
                          className="btn sm"
                          onClick={() => openModal('city', c)}
                        >עריכה</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                className="btn sm"
                style={{ marginTop: 12 }}
                onClick={() => openModal('city')}
              >+ הוספת עיר</button>
            </div>
          )}
        </div>

        {/* === GLOBAL SETTINGS === */}
        <div className="panel">
          <div className="panel-title">הגדרות כלליות</div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>ימים ללא גביה להתראה (גלובלי)</label>
            <input
              type="number"
              min="1"
              max="3650"
              value={alertDays}
              onChange={(e) => setAlertDays(e.target.value)}
              style={{ width: 120 }}
            />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              ערך זה משמש כברירת מחדל. ניתן לדרוס אותו ברמת עיר (במילון הערים) או ברמת כרטסת. היררכיה: גלובלי → עיר → קופה.
            </div>
          </div>

          {globalMsg && (
            <div className={'alert ' + globalMsg.type} style={{ marginBottom: 12 }}>
              {globalMsg.text}
            </div>
          )}

          <button
            className="btn primary sm"
            onClick={saveGlobal}
            disabled={savingGlobal || !isDirty}
          >
            {savingGlobal ? 'שומר...' : 'שמירה'}
          </button>
          {isDirty && !savingGlobal && (
            <button
              className="btn sm"
              style={{ marginInlineStart: 8 }}
              onClick={() => { setAlertDays(origAlertDays); setGlobalMsg(null) }}
            >ביטול</button>
          )}
        </div>

      </div>

      <TaskTypeModal
        open={modal?.which === 'task'}
        item={modal?.which === 'task' ? modal.item : null}
        onClose={closeModal}
        onSaved={(saved) => upsert(setTaskList, saved)}
        onDeleted={(id) => removeById(setTaskList, id)}
      />

      <ReportTypeModal
        open={modal?.which === 'report'}
        item={modal?.which === 'report' ? modal.item : null}
        onClose={closeModal}
        onSaved={(saved) => upsert(setReportList, saved)}
        onDeleted={(id) => removeById(setReportList, id)}
      />

      <BoxTypeModal
        open={modal?.which === 'box'}
        item={modal?.which === 'box' ? modal.item : null}
        onClose={closeModal}
        onSaved={(saved) => upsert(setBoxList, saved)}
        onDeleted={(id) => removeById(setBoxList, id)}
      />

      <CityModal
        open={modal?.which === 'city'}
        item={modal?.which === 'city' ? modal.item : null}
        prefillName={modal?.which === 'city' ? modal.prefillName : undefined}
        onClose={closeModal}
        onSaved={(saved) => { upsert(setCityList, saved); refreshUnassigned() }}
        onDeleted={(id) => { removeById(setCityList, id); refreshUnassigned() }}
      />
    </div>
  )
}
