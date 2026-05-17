import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cards as cardsApi } from '../api/endpoints'
import { useAuth } from '@shared/context/AuthContext'
import { computeCardLabels } from '@shared/utils/cardLabel'
import EnvelopesTab from './cardTabs/EnvelopesTab'
import EventsTab    from './cardTabs/EventsTab'
import TasksTab     from './cardTabs/TasksTab'
import ReportsTab   from './cardTabs/ReportsTab'
import CloseCardModal from '../components/CloseCardModal'
import ReopenCardModal from '../components/ReopenCardModal'
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
  const [cardLabel, setCardLabel] = useState(null) // e.g. "1019A"
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

  // Geocode actions (task 61)
  const [geocodeBusy, setGeocodeBusy]   = useState(false)
  const [geocodeMsg,  setGeocodeMsg]    = useState(null)
  // Manual marker drag (task 62) — when the admin drags the marker we keep
  // the new coords here. null means "no manual override, use card.lat/lng".
  const [dragCoords, setDragCoords]     = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrMsg(null)
      try {
        const data = await cardsApi.get(id)
        if (cancelled) return
        setCard(data)
        // Fetch the box's full card history to compute the suffix letter
        try {
          const history = await cardsApi.history(id)
          if (cancelled) return
          const labels = computeCardLabels(history)
          setCardLabel(labels.get(Number(id)) || null)
        } catch {
          // non-fatal — fall back to ID
        }
      } catch (err) {
        if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת הכרטסת')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

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

  async function handleReopenCard(reason) {
    // The reopen response doesn't include the joined fields (iron_number, box_status,
    // box_type_name, collector_name). Merge so the read-only view stays correct.
    const updated = await cardsApi.reopen(id, reason)
    setCard(prev => ({ ...prev, ...updated }))
    setShowReopenModal(false)
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
  const labelOrId = cardLabel || `#${card.id}`
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
          <div className="v">{cardLabel || `#${card.id}`}</div>
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
          </div>

          {geocodeMsg && (
            <div className={'alert ' + geocodeMsg.type} style={{ marginBottom: 10 }}>
              {geocodeMsg.text}
            </div>
          )}

          {card.geocode_status === 'ok' && card.latitude != null && card.longitude != null ? (
            <>
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
                {card.geocode_status === 'not_found' && 'הכתובת לא נמצאה במאגר המפות (גוגל לא מצא את הרחוב בעיר הזו).'}
                {card.geocode_status === 'error'     && 'שגיאה בתרגום הכתובת. ודא שמפתח Google Maps API מוגדר בהגדרות.'}
                {card.geocode_status === 'disabled'  && 'שירות הגיאוקודינג מושבת — מפתח Google Maps API לא הוגדר בהגדרות.'}
                {!card.geocode_status               && 'הכתובת עדיין לא תורגמה לקואורדינטות.'}
              </div>
              <button
                className="btn sm"
                onClick={handleRegeocode}
                disabled={geocodeBusy}
              >
                🔄 תרגם כתובת
              </button>
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
    </div>
  )
}
