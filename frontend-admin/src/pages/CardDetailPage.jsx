import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cards as cardsApi } from '../api/endpoints'
import { useAuth } from '@shared/context/AuthContext'
import EnvelopesTab from './cardTabs/EnvelopesTab'
import EventsTab    from './cardTabs/EventsTab'
import TasksTab     from './cardTabs/TasksTab'
import ReportsTab   from './cardTabs/ReportsTab'
import CloseCardModal from '../components/CloseCardModal'
import ReopenCardModal from '../components/ReopenCardModal'
import SwapBoxModal from '../components/SwapBoxModal'
import LocationCombobox from '../components/LocationCombobox'
import MapView from '@shared/components/MapView'

const ALL_TABS = [
  { key: 'envelopes', label: '✉️ מעטפות' },
  { key: 'events',    label: '📅 אירועים' },
  { key: 'tasks',     label: '✅ משימות' },
  { key: 'reports',   label: '⚠️ דיווחים' },
]

// Format ISO date to Hebrew DD/MM/YYYY
function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('he-IL')
  } catch {
    return iso
  }
}

const STATUS_PILL = {
  active: { label: 'כרטסת פעילה', cls: 'green' },
  closed: { label: 'כרטסת סגורה', cls: 'gray'  },
}

export default function CardDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isCollector = user?.role === 'collector'

  // Task 35: collectors don't see the envelopes tab.
  const TABS = isCollector ? ALL_TABS.filter(t => t.key !== 'envelopes') : ALL_TABS

  const [card, setCard]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg]   = useState(null)
  const [activeTab, setActiveTab] = useState(isCollector ? 'events' : 'envelopes')

  // Edit mode
  const [editing, setEditing]     = useState(false)
  const [form, setForm]           = useState(null)
  const [saving, setSaving]       = useState(false)
  const [saveErr, setSaveErr]     = useState(null)

  // Close card mode
  const [showCloseModal, setShowCloseModal] = useState(false)

  // Reopen card mode
  const [showReopenModal, setShowReopenModal] = useState(false)

  // Swap box mode (task 51)
  const [showSwapBoxModal, setShowSwapBoxModal] = useState(false)

  // Geocode actions (task 61)
  const [geocodeBusy, setGeocodeBusy]   = useState(false)
  const [geocodeMsg,  setGeocodeMsg]    = useState(null)
  // Manual marker drag (task 62) — when the admin drags the marker we keep
  // the new coords here. null means "no manual override, use card.lat/lng".
  const [dragCoords, setDragCoords]     = useState(null)
  // Manual-pin fallback for `not_found` / `error` / never-geocoded cards.
  // Bnei Brak (and some Jerusalem neighborhoods) aren't covered well by
  // Google's Hebrew geocoder — see backend/scripts/diagnoseGeocode.js. We
  // seed the map with the city/neighborhood centroid and let the admin drag
  // the pin to the real location.
  const [manualPinCenter, setManualPinCenter] = useState(null) // {lat,lng} or null
  const [manualPinCoords, setManualPinCoords] = useState(null) // {lat,lng} or null
  const [manualPinLoading, setManualPinLoading] = useState(false)
  const [manualPinError, setManualPinError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrMsg(null)
      try {
        const data = await cardsApi.get(id)
        if (cancelled) return
        setCard(data)
      } catch (err) {
        if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת הכרטסת')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Auto-load the locality centre so the admin can manually pin cards whose
  // address Google couldn't resolve (`not_found` / `error` / never-attempted).
  // Skipped for `disabled` (no API key — the map won't render anyway) and for
  // cards that already have coordinates (regular drag flow handles those).
  //
  // Dep array uses PRIMITIVE card fields (not `card` itself) so unrelated state
  // changes don't re-trigger this effect. The state setters we call here
  // (setManualPinLoading, setManualPinCenter) are intentionally NOT in deps —
  // including them would cause the effect to re-run mid-request, the cleanup
  // would mark the request `cancelled = true`, and the response would silently
  // be dropped (which is exactly the bug we hit the first time around).
  useEffect(() => {
    if (!card || isCollector || editing) return
    const status = card.geocode_status
    const hasCoords = card.latitude != null && card.longitude != null
    const needsManualPin =
      !hasCoords &&
      (status === 'not_found' || status === 'error' || status == null)
    if (!needsManualPin) return

    let cancelled = false
    setManualPinLoading(true)
    setManualPinError(null)
    setManualPinCenter(null)
    setManualPinCoords(null)

    cardsApi.localityCenter(id)
      .then((c) => {
        if (cancelled) return
        if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
          setManualPinCenter({ lat: c.lat, lng: c.lng })
          setManualPinCoords({ lat: c.lat, lng: c.lng })
        } else {
          setManualPinError('לא ניתן לאתר את מרכז העיר. גרור את הסיכה מהמיקום ההתחלתי.')
        }
      })
      .catch((err) => {
        if (cancelled) return
        // 404 just means "Google couldn't find the city either" — fall back
        // to Israel's geographic centre so the admin can still pin something.
        if (err?.status === 404 || err?.data?.error === 'Could not geocode locality') {
          const fallback = { lat: 31.5, lng: 35.0 }
          setManualPinCenter(fallback)
          setManualPinCoords(fallback)
          setManualPinError('גוגל לא מצא את העיר. המפה ממוקמת על מרכז ישראל — גרור לאזור הנכון.')
        } else {
          setManualPinError(err?.message || 'שגיאה בטעינת מרכז העיר')
        }
      })
      .finally(() => { if (!cancelled) setManualPinLoading(false) })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, card?.geocode_status, card?.latitude, card?.longitude, isCollector, editing])

  // ── Edit mode handlers ────────────────────────────────────────────
  function handleEdit() {
    setForm({
      city:                 card.city ?? '',
      neighborhood:         card.neighborhood ?? '',
      street:               card.street ?? '',
      building:             card.building ?? '',
      location_notes:       card.location_notes ?? '',
      custom_name:          card.custom_name ?? '',
      alert_days_personal:  card.alert_days_personal ?? '',
      receipt_required:     !!card.receipt_required,
      receipt_details:      card.receipt_details ?? '',
      installation_type:    card.installation_type ?? '',
    })
    setSaveErr(null)
    setEditing(true)
  }

  function handleCancel() {
    setEditing(false)
    setForm(null)
    setSaveErr(null)
  }

  function updateForm(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaveErr(null)
    setSaving(true)
    try {
      // Build payload, converting empty strings to null where appropriate.
      // collector_id is intentionally omitted: it is derived from the user's
      // area-assignment rules at read time.
      const payload = {
        city:                form.city || null,
        neighborhood:        form.neighborhood || null,
        street:              form.street || null,
        building:            form.building || null,
        location_notes:      form.location_notes || null,
        custom_name:         form.custom_name || null,
        alert_days_personal: form.alert_days_personal === '' || form.alert_days_personal === null
                               ? null
                               : Number(form.alert_days_personal),
        receipt_required:    !!form.receipt_required,
        receipt_details:     form.receipt_details || null,
        installation_type:   form.installation_type?.trim() ? form.installation_type.trim() : null,
      }
      const updated = await cardsApi.update(id, payload)
      // The PUT response doesn't include the joined fields (iron_number, collector_name, box_type_name).
      // Merge so the read-only view stays correct.
      setCard(prev => ({ ...prev, ...updated }))
      setEditing(false)
      setForm(null)
    } catch (err) {
      setSaveErr(err.message || 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  async function handleCloseCard(reason) {
    try {
      const updated = await cardsApi.close(id, reason)
      setCard(updated)
      setShowCloseModal(false)
    } catch (err) {
      throw err
    }
  }

  // ── Geocode actions (task 61) ─────────────────────────────────────
  async function reloadCard() {
    try {
      const fresh = await cardsApi.get(id)
      setCard(prev => ({ ...prev, ...fresh }))
    } catch { /* non-fatal */ }
  }

  async function handleRegeocode() {
    setGeocodeMsg(null)
    setGeocodeBusy(true)
    setDragCoords(null)
    try {
      await cardsApi.geocode(id)
      await reloadCard()
      setGeocodeMsg({ type: 'green', text: 'הכתובת תורגמה מחדש. בדוק את הסיכה במפה ואשר.' })
    } catch (err) {
      setGeocodeMsg({ type: 'red', text: err.message || 'שגיאה בגיאוקודינג' })
    } finally {
      setGeocodeBusy(false)
    }
  }

  async function handleApproveGeocode() {
    setGeocodeMsg(null)
    setGeocodeBusy(true)
    try {
      await cardsApi.approveGeocode(id, dragCoords || undefined)
      setDragCoords(null)
      await reloadCard()
      setGeocodeMsg({ type: 'green', text: 'המיקום אושר.' })
    } catch (err) {
      setGeocodeMsg({ type: 'red', text: err.message || 'שגיאה באישור המיקום' })
    } finally {
      setGeocodeBusy(false)
    }
  }

  async function handleSaveDrag() {
    if (!dragCoords) return
    setGeocodeMsg(null)
    setGeocodeBusy(true)
    try {
      await cardsApi.approveGeocode(id, dragCoords)
      setDragCoords(null)
      await reloadCard()
      setGeocodeMsg({ type: 'green', text: 'המיקום החדש נשמר ואושר.' })
    } catch (err) {
      setGeocodeMsg({ type: 'red', text: err.message || 'שגיאה בשמירת המיקום' })
    } finally {
      setGeocodeBusy(false)
    }
  }

  async function handleSaveManualPin() {
    if (!manualPinCoords) return
    setGeocodeMsg(null)
    setGeocodeBusy(true)
    try {
      await cardsApi.approveGeocode(id, manualPinCoords)
      setManualPinCoords(null)
      setManualPinCenter(null)
      await reloadCard()
      setGeocodeMsg({ type: 'green', text: 'המיקום נשמר ידנית ואושר.' })
    } catch (err) {
      setGeocodeMsg({ type: 'red', text: err.message || 'שגיאה בשמירת המיקום' })
    } finally {
      setGeocodeBusy(false)
    }
  }

  async function handleReopenCard(reason) {
    // The reopen response doesn't include the joined fields (iron_number, box_status,
    // box_type_name, collector_name). Merge so the read-only view stays correct.
    const updated = await cardsApi.reopen(id, reason)
    setCard(prev => ({ ...prev, ...updated }))
    setShowReopenModal(false)
  }

  async function handleSwapBox({ iron_number, reason }) {
    const updated = await cardsApi.swapBox(id, { iron_number, reason })
    setCard(prev => ({ ...prev, ...updated }))
    setShowSwapBoxModal(false)
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="loading"><div className="spinner" /><span>טוען כרטסת...</span></div>
      </div>
    )
  }

  if (errMsg) {
    return (
      <div className="screen">
        <div className="alert red">{errMsg}</div>
        <button className="btn" onClick={() => navigate('/cards')}>← חזרה לכרטסות</button>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="screen">
        <div className="empty">כרטסת לא נמצאה</div>
        <button className="btn" onClick={() => navigate('/cards')}>← חזרה לכרטסות</button>
      </div>
    )
  }

  const statusPill = STATUS_PILL[card.status] || { label: card.status, cls: 'gray' }
  // Card code is iron_number + card_letter (e.g. "100482A"). card_letter is
  // assigned by the server in openCard() and stored on the row.
  const cardCode = (card.iron_number && card.card_letter)
    ? `${card.iron_number}${card.card_letter}`
    : null
  const labelOrId = cardCode || `#${card.id}`
  const titleLabel = card.custom_name
    ? `${card.custom_name} (${labelOrId})`
    : labelOrId
  const subtitle = [card.city, card.neighborhood, card.street && `${card.street}${card.building ? ' ' + card.building : ''}`]
    .filter(Boolean).join(' | ')

  return (
    <div className="screen">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <div className="breadcrumb" onClick={() => navigate('/cards')}>← חזרה לכרטסות</div>
          <div className="page-title">
            כרטסת {titleLabel} &nbsp;|&nbsp; קופה {card.iron_number || '—'}
          </div>
          <div className="page-subtitle">
            {subtitle || 'אין פרטי מיקום'}
            {card.collector_name && ` | גובה: ${card.collector_name}`}
          </div>
        </div>
        <div className="actions">
          <span className={'pill ' + statusPill.cls} style={{ padding: '6px 14px', fontSize: 13 }}>
            {statusPill.label}
          </span>
          {!editing && card.status === 'active' && !isCollector && (
            <>
              <button className="btn sm" onClick={handleEdit}>✏️ עריכת פרטים</button>
              <button className="btn sm" onClick={() => setShowSwapBoxModal(true)}>🔁 החלף קופה</button>
              <button className="btn sm danger" onClick={() => setShowCloseModal(true)}>🚪 סגירת כרטסת</button>
            </>
          )}
          {!editing && card.status === 'closed' && !isCollector && (
            <button className="btn sm success" onClick={() => setShowReopenModal(true)}>
              🔓 פתיחה מחדש
            </button>
          )}
        </div>
      </div>

      {/* SAVE ERROR */}
      {saveErr && <div className="alert red">{saveErr}</div>}

      {/* EDIT FORM */}
      {editing && form && (
        <div className="panel" style={{ borderColor: 'var(--accent)' }}>
          <div className="panel-title" style={{ color: 'var(--accent)' }}>✏️ מצב עריכה</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>עיר</label>
              <LocationCombobox
                level="city"
                value={form.city}
                onChange={(v) => updateForm('city', v)}
              />
            </div>
            <div className="field">
              <label>שכונה</label>
              <LocationCombobox
                level="neighborhood"
                value={form.neighborhood}
                onChange={(v) => updateForm('neighborhood', v)}
                city={form.city}
              />
            </div>
            <div className="field">
              <label>רחוב</label>
              <LocationCombobox
                level="street"
                value={form.street}
                onChange={(v) => updateForm('street', v)}
                city={form.city}
                neighborhood={form.neighborhood}
              />
            </div>
            <div className="field">
              <label>מספר בנין</label>
              <input value={form.building} onChange={e => updateForm('building', e.target.value)} />
            </div>
            <div className="field">
              <label>שם מותאם <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
              <input
                value={form.custom_name}
                onChange={e => updateForm('custom_name', e.target.value)}
                placeholder='למשל: "שובע שמחות"'
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>הערות מיקום</label>
            <input value={form.location_notes} onChange={e => updateForm('location_notes', e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>סוג התקנה <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
            <input
              value={form.installation_type ?? ''}
              onChange={e => updateForm('installation_type', e.target.value)}
              placeholder="למשל: קיר, תקרה, עמוד"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="field">
              <label>טווח התראה אישי <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי — גובר על הגלובלי)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  placeholder="ימים"
                  style={{ width: 100 }}
                  value={form.alert_days_personal}
                  onChange={e => updateForm('alert_days_personal', e.target.value)}
                />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>ימים</span>
              </div>
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={form.receipt_required}
                  onChange={e => updateForm('receipt_required', e.target.checked)}
                />
                דרוש קבלה
              </label>
              {form.receipt_required && (
                <textarea
                  placeholder="פרטי הקבלה — למשל: יש לקבל חתימה מהמנהל..."
                  value={form.receipt_details}
                  onChange={e => updateForm('receipt_details', e.target.value)}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          </div>

          <div className="actions">
            <button className="btn success" onClick={handleSave} disabled={saving}>
              {saving ? 'שומר...' : '✅ שמירה'}
            </button>
            <button className="btn" onClick={handleCancel} disabled={saving}>ביטול</button>
          </div>
        </div>
      )}

      {/* INFO GRID (read-only) */}
      {!editing && <div className="info-grid">
        <div className="info-card">
          <div className="k">מספר קופה (ברזל)</div>
          <div className="v">{card.iron_number || '—'}</div>
        </div>
        <div className="info-card">
          <div className="k">קוד כרטסת</div>
          <div className="v">{cardCode || `#${card.id}`}</div>
        </div>
        <div className="info-card">
          <div className="k">שם מותאם</div>
          <div className="v" style={{ color: card.custom_name ? 'var(--text)' : 'var(--text3)', fontStyle: card.custom_name ? 'normal' : 'italic' }}>
            {card.custom_name || 'לא הוגדר'}
          </div>
        </div>
        <div className="info-card">
          <div className="k">סוג קופה</div>
          <div className="v">{card.box_type_name || '—'}</div>
        </div>
        <div className="info-card">
          <div className="k">סוג התקנה</div>
          <div className="v" style={{ color: card.installation_type ? 'var(--text)' : 'var(--text3)', fontStyle: card.installation_type ? 'normal' : 'italic' }}>
            {card.installation_type || 'לא הוגדר'}
          </div>
        </div>
        <div className="info-card">
          <div className="k">עיר</div>
          <div className="v">{card.city || '—'}</div>
        </div>
        <div className="info-card">
          <div className="k">שכונה</div>
          <div className="v">{card.neighborhood || '—'}</div>
        </div>
        <div className="info-card">
          <div className="k">רחוב + בנין</div>
          <div className="v">
            {card.street ? `${card.street}${card.building ? ' ' + card.building : ''}` : '—'}
          </div>
        </div>
        <div className="info-card" style={{ gridColumn: 'span 2' }}>
          <div className="k">הערות מיקום</div>
          <div className="v">{card.location_notes || '—'}</div>
        </div>
        <div className="info-card">
          <div className="k">גובה משויך <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}>(לפי כללי האזורים)</span></div>
          <div className="v">{card.collector_name || <span style={{ color: 'var(--text3)' }}>אין גובה תואם בכללים</span>}</div>
        </div>
        <div className="info-card">
          <div className="k">דרוש קבלה</div>
          <div className="v">{card.receipt_required ? 'כן' : 'לא'}</div>
        </div>
        <div className="info-card">
          <div className="k">טווח התראה</div>
          <div className="v">
            {card.alert_days_personal
              ? `${card.alert_days_personal} ימים (אישי)`
              : 'גלובלי (ברירת מחדל)'}
          </div>
        </div>
        <div className="info-card">
          <div className="k">תאריך פתיחת כרטסת</div>
          <div className="v">{formatDate(card.opened_at)}</div>
        </div>
        {card.status === 'closed' && (
          <>
            <div className="info-card">
              <div className="k">תאריך סגירה</div>
              <div className="v">{formatDate(card.closed_at)}</div>
            </div>
            <div className="info-card">
              <div className="k">סיבת סגירה</div>
              <div className="v">{card.closed_reason || '—'}</div>
            </div>
          </>
        )}
      </div>}

      {/* MAP — task 61: visual confirmation of the geocoded address */}
      {!editing && !isCollector && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-title">
            🗺️ מיקום הקופה על המפה
            {card.geocode_status === 'ok' && card.geocode_approved && (
              <span className="pill green" style={{ marginInlineStart: 8, padding: '2px 10px', fontSize: 11 }}>
                ✓ אושר
              </span>
            )}
            {card.geocode_status === 'ok' && !card.geocode_approved && (
              <span className="pill" style={{ marginInlineStart: 8, padding: '2px 10px', fontSize: 11, background: 'var(--bg2, #f3f4f6)', color: 'var(--text2, #6b7280)' }}>
                ממתין לאישור
              </span>
            )}
            {card.geocode_status === 'neighborhood_center' && card.geocode_approved && (
              <span className="pill green" style={{ marginInlineStart: 8, padding: '2px 10px', fontSize: 11 }}>
                ✓ אושר (מרכז שכונה)
              </span>
            )}
            {card.geocode_status === 'neighborhood_center' && !card.geocode_approved && (
              <span className="pill" style={{ marginInlineStart: 8, padding: '2px 10px', fontSize: 11, background: '#fef3c7', color: '#92400e' }}>
                📍 מרכז שכונה — דורש אישור ידני
              </span>
            )}
          </div>

          {geocodeMsg && (
            <div className={'alert ' + geocodeMsg.type} style={{ marginBottom: 10 }}>
              {geocodeMsg.text}
            </div>
          )}

          {(card.geocode_status === 'ok' || card.geocode_status === 'neighborhood_center')
            && card.latitude != null && card.longitude != null ? (
            <>
              {card.geocode_status === 'neighborhood_center' && (
                <div className="alert info" style={{ marginBottom: 10 }}>
                  מיקום משוער — מרכז השכונה{card.neighborhood ? ` "${card.neighborhood}"` : ''}.
                  אין נתוני רחוב/מספר עבור הכרטסת. גרור את הסיכה למיקום המדויק ושמור, או אשר את המיקום כפי שהוא.
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                ניתן לגרור את הסיכה למיקום מדויק יותר ולשמור.
              </div>
              <MapView
                lat={Number(dragCoords?.lat ?? card.latitude)}
                lng={Number(dragCoords?.lng ?? card.longitude)}
                height={300}
                popupText={subtitle || titleLabel}
                draggable={true}
                onMarkerDrag={(lat, lng) => setDragCoords({ lat, lng })}
              />
              <div className="actions" style={{ marginTop: 12 }}>
                {dragCoords ? (
                  <>
                    <button
                      className="btn success sm"
                      onClick={handleSaveDrag}
                      disabled={geocodeBusy}
                    >
                      💾 שמור מיקום חדש
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => setDragCoords(null)}
                      disabled={geocodeBusy}
                    >
                      ביטול גרירה
                    </button>
                  </>
                ) : !card.geocode_approved ? (
                  <button
                    className="btn success sm"
                    onClick={handleApproveGeocode}
                    disabled={geocodeBusy}
                  >
                    ✅ אשר מיקום
                  </button>
                ) : null}
                {!dragCoords && (
                  <button
                    className="btn sm"
                    onClick={handleRegeocode}
                    disabled={geocodeBusy}
                  >
                    🔄 תרגם כתובת מחדש
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="alert info" style={{ marginBottom: 10 }}>
                {card.geocode_status === 'not_found' && 'הכתובת לא נמצאה במאגר המפות של גוגל. גרור את הסיכה במפה למיקום המדויק של הקופה ולחץ "שמור מיקום".'}
                {card.geocode_status === 'error'     && 'שגיאה בתרגום הכתובת. ניתן למקם ידנית במפה למטה, או לנסות שוב.'}
                {card.geocode_status === 'disabled'  && 'שירות הגיאוקודינג מושבת — מפתח Google Maps API לא הוגדר בהגדרות.'}
                {!card.geocode_status               && 'הכתובת עדיין לא תורגמה לקואורדינטות. ניתן לבחור מיקום ידני במפה למטה.'}
              </div>

              {manualPinError && (
                <div className="alert warn" style={{ marginBottom: 10 }}>
                  {manualPinError}
                </div>
              )}

              {manualPinLoading && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                  טוען מפה למיקום ידני...
                </div>
              )}

              {manualPinCenter && card.geocode_status !== 'disabled' && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                    📍 המפה ממוקמת על מרכז {card.neighborhood ? `השכונה "${card.neighborhood}"` : `העיר "${card.city || ''}"`}.
                    גרור את הסיכה למיקום המדויק של הקופה ולחץ "שמור מיקום".
                  </div>
                  <MapView
                    lat={Number(manualPinCenter.lat)}
                    lng={Number(manualPinCenter.lng)}
                    height={320}
                    zoom={16}
                    popupText={subtitle || titleLabel}
                    draggable={true}
                    onMarkerDrag={(lat, lng) => setManualPinCoords({ lat, lng })}
                  />
                </>
              )}

              <div className="actions" style={{ marginTop: 12 }}>
                {manualPinCenter && card.geocode_status !== 'disabled' && (
                  <button
                    className="btn success sm"
                    onClick={handleSaveManualPin}
                    disabled={geocodeBusy || !manualPinCoords}
                  >
                    💾 שמור מיקום
                  </button>
                )}
                <button
                  className="btn sm"
                  onClick={handleRegeocode}
                  disabled={geocodeBusy}
                >
                  🔄 נסה תרגום אוטומטי{manualPinCenter ? ' שוב' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TABS */}
      <div className="tabs" style={{ marginTop: 20 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={'tab-btn' + (activeTab === t.key ? ' active' : '')}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel">
        {activeTab === 'envelopes' && !isCollector && <EnvelopesTab cardId={card.id} boxId={card.box_id} />}
        {activeTab === 'events'    && <EventsTab    cardId={card.id} cardLabel={titleLabel} />}
        {activeTab === 'tasks'     && <TasksTab     cardId={card.id} boxId={card.box_id} />}
        {activeTab === 'reports'   && <ReportsTab   cardId={card.id} cardLabel={titleLabel} />}
      </div>

      {showCloseModal && (
        <CloseCardModal
          cardId={card.id}
          cardLabel={titleLabel}
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleCloseCard}
        />
      )}
      {showReopenModal && (
        <ReopenCardModal
          cardLabel={titleLabel}
          onClose={() => setShowReopenModal(false)}
          onConfirm={handleReopenCard}
        />
      )}
      {showSwapBoxModal && (
        <SwapBoxModal
          cardLabel={titleLabel}
          currentIron={card.iron_number}
          onClose={() => setShowSwapBoxModal(false)}
          onConfirm={handleSwapBox}
        />
      )}
    </div>
  )
}
