import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Geolocation } from '@capacitor/geolocation'
import {
  cards as cardsApi,
  locationOverrides as overridesApi,
  reports as reportsApi,
} from '../api/endpoints'
import { useData } from '@shared/context/DataStoreContext'
import { computeCardLabels } from '@shared/utils/cardLabel'
import Modal from '@shared/components/Modal'
import MapView from '@shared/components/MapView'

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatAddress(c) {
  if (!c) return '—'
  const parts = [c.city, c.neighborhood, c.street, c.building]
    .filter((s) => typeof s === 'string' && s.trim())
  return parts.length ? parts.join(', ') : '—'
}

async function getDevicePosition() {
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    })
    return { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch (err) {
    return { ok: false, error: err?.message || 'geolocation_failed' }
  }
}

export default function CollectionPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Card comes from the central store, filtered by ID. Store stays current via
  // Socket.IO so the address/notes/last-collection date refresh automatically
  // when an admin (or another collector) edits the card.
  const { data: cardsList, loading } = useData('cards')
  const card = useMemo(() => {
    if (!cardId || !Array.isArray(cardsList)) return null
    const id = Number(cardId)
    return cardsList.find((c) => Number(c.id) === id) || null
  }, [cardsList, cardId])
  const error = null

  const [boxNumberInput, setBoxNumberInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)

  // Task 58/52 — unified GPS verification failure modal.
  // verifyFailure shape: { card, kind: 'out_of_radius'|'unavailable', distance, lat, lng }
  // reportMode: when true, the modal switches from the 3-button view to the
  // inline report-writing view (textarea + create-and-scan / cancel).
  const [verifying, setVerifying] = useState(false)
  const [verifyFailure, setVerifyFailure] = useState(null)
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)
  const [reportMode, setReportMode] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportError, setReportError] = useState(null)

  const CONTINUE_WITHOUT_REPORT_REASON = 'המשך ללא דיווח מיקום שגוי'
  const REPORT_PREFIX = 'כתובת שגויה: '

  const [toast, setToast] = useState(null)

  useEffect(() => {
    const t = location.state?.toast
    if (!t) return
    setToast(t)
    navigate(location.pathname, { replace: true, state: {} })
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [location.state, location.pathname, navigate])

  const cardLabel = useMemo(() => {
    if (!card) return ''
    const labels = computeCardLabels([card])
    return labels.get(card.id) || String(card.iron_number ?? '')
  }, [card])

  // Run the GPS check before navigating to the scanner.
  // Every failure path (no GPS, API error, no card coords, out of radius) opens
  // the same unified modal — kind differentiates the message; data is recorded
  // only when we actually have GPS coordinates.
  async function runVerification(targetCard) {
    if (!targetCard) return
    setVerifying(true)
    try {
      const pos = await getDevicePosition()
      if (!pos.ok) {
        openVerifyFailure({ card: targetCard, kind: 'unavailable' })
        return
      }
      let result
      try {
        result = await cardsApi.verifyLocation(targetCard.id, pos.lat, pos.lng)
      } catch {
        openVerifyFailure({
          card: targetCard, kind: 'unavailable', lat: pos.lat, lng: pos.lng,
        })
        return
      }

      if (result.within_radius) {
        navigate(`/scan/${targetCard.id}`)
        return
      }

      if (!result.card_geocoded) {
        openVerifyFailure({
          card: targetCard, kind: 'unavailable', lat: pos.lat, lng: pos.lng,
        })
        return
      }

      openVerifyFailure({
        card: targetCard,
        kind: 'out_of_radius',
        distance: result.distance_meters ?? null,
        lat: pos.lat,
        lng: pos.lng,
      })
    } finally {
      setVerifying(false)
    }
  }

  function openVerifyFailure(payload) {
    setReportMode(false)
    setReportText(REPORT_PREFIX)
    setReportError(null)
    setVerifyFailure({
      card: payload.card,
      kind: payload.kind,
      distance: payload.distance ?? null,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
    })
  }

  function closeVerifyFailure() {
    setVerifyFailure(null)
    setReportMode(false)
    setReportText('')
    setReportError(null)
  }

  async function continueWithoutReport() {
    if (!verifyFailure) return
    setOverrideSubmitting(true)
    try {
      // Only log an override when we actually have GPS coordinates. With no
      // coordinates the row would carry no useful audit signal.
      if (verifyFailure.lat != null && verifyFailure.lng != null) {
        try {
          await overridesApi.create({
            card_id: verifyFailure.card.id,
            distance_meters: verifyFailure.distance,
            reason: CONTINUE_WITHOUT_REPORT_REASON,
            gps_lat: verifyFailure.lat,
            gps_lng: verifyFailure.lng,
          })
        } catch (err) {
          // Don't block collection if the audit log call failed; just warn in console.
          console.warn('[location-override] save failed', err.message)
        }
      }
      const id = verifyFailure.card.id
      closeVerifyFailure()
      navigate(`/scan/${id}`)
    } finally {
      setOverrideSubmitting(false)
    }
  }

  async function submitInlineReport() {
    if (!verifyFailure) return
    const trimmed = reportText.trim()
    if (trimmed.length <= REPORT_PREFIX.trim().length) {
      setReportError('יש להוסיף פרטים אחרי הקידומת')
      return
    }
    setReportError(null)
    setReportSubmitting(true)
    try {
      await reportsApi.create({
        card_id: verifyFailure.card.id,
        report_type_id: null,
        description: trimmed,
        image_path: null,
      })
      const id = verifyFailure.card.id
      closeVerifyFailure()
      navigate(`/scan/${id}`)
    } catch (err) {
      setReportError(err?.message || 'שגיאה ביצירת הדיווח')
    } finally {
      setReportSubmitting(false)
    }
  }

  async function lookupAndGo(targetPath, e) {
    e?.preventDefault?.()
    const num = boxNumberInput.trim()
    if (!num) return
    setLookupError(null)
    setLookupLoading(true)
    try {
      const found = await cardsApi.lookupByIron(num)
      navigate(targetPath(found.id))
    } catch (err) {
      const code = err?.data?.error
      if (code === 'box_not_found')      setLookupError('מספר קופה שגוי')
      else if (code === 'not_assigned')  setLookupError('קופה זו אינה משויכת אליך')
      else if (code === 'card_closed')   setLookupError('כרטסת הקופה סגורה')
      else                                setLookupError(err.message || 'שגיאה באחזור הקופה')
    } finally {
      setLookupLoading(false)
    }
  }

  async function lookupAndVerify(e) {
    e?.preventDefault?.()
    const num = boxNumberInput.trim()
    if (!num) return
    setLookupError(null)
    setLookupLoading(true)
    try {
      const found = await cardsApi.lookupByIron(num)
      const full = await cardsApi.get(found.id).catch(() => found)
      await runVerification(full || found)
    } catch (err) {
      const code = err?.data?.error
      if (code === 'box_not_found')      setLookupError('מספר קופה שגוי')
      else if (code === 'not_assigned')  setLookupError('קופה זו אינה משויכת אליך')
      else if (code === 'card_closed')   setLookupError('כרטסת הקופה סגורה')
      else                                setLookupError(err.message || 'שגיאה באחזור הקופה')
    } finally {
      setLookupLoading(false)
    }
  }

  // Unified GPS-verification failure modal. Two visual states:
  //   reportMode=false → 3 buttons (continue / report / cancel)
  //   reportMode=true  → inline textarea + (create-and-scan / cancel)
  // The body is closed only on explicit cancel; clicking outside is disabled
  // while a network call is in flight.
  function renderVerificationModals() {
    const busy = overrideSubmitting || reportSubmitting
    const title = reportMode
      ? 'דיווח על מיקום שגוי'
      : 'לא הצלחנו לאמת את המיקום'
    return (
      <Modal
        open={!!verifyFailure}
        title={title}
        onClose={busy ? undefined : closeVerifyFailure}
      >
        {verifyFailure && !reportMode && (
          <div className="collection-info">
            {verifyFailure.kind === 'out_of_radius' ? (
              <div className="alert red" style={{ marginBottom: 10 }}>
                המיקום שלך רחוק כ-<b>{verifyFailure.distance ?? '—'}</b> מ' מהכתובת
                הרשומה של הקופה.
              </div>
            ) : (
              <div className="alert info" style={{ marginBottom: 10 }}>
                לא הצלחנו לקבל את המיקום מהמכשיר.<br/>
                מומלץ לאפשר הרשאת מיקום באפליקציה. ניתן להמשיך גם בלי אימות.
              </div>
            )}
            <div className="kv">
              <span className="k">מספר קופה</span>
              <span className="v">{verifyFailure.card.iron_number ?? '—'}</span>
            </div>
            <div className="kv">
              <span className="k">כתובת רשומה</span>
              <span className="v">{formatAddress(verifyFailure.card)}</span>
            </div>
            {verifyFailure.card.location_notes && (
              <div className="kv">
                <span className="k">הערות מיקום</span>
                <span className="v">{verifyFailure.card.location_notes}</span>
              </div>
            )}
            <div className="collection-actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn-block"
                disabled={busy}
                onClick={continueWithoutReport}
              >
                {overrideSubmitting ? 'ממשיך...' : '✓ אישור והמשך'}
              </button>
              <button
                type="button"
                className="btn-block secondary"
                disabled={busy}
                onClick={() => {
                  setReportError(null)
                  setReportMode(true)
                }}
              >
                📝 דווח על מיקום שגוי
              </button>
              <button
                type="button"
                className="btn-block secondary"
                disabled={busy}
                onClick={() => {
                  closeVerifyFailure()
                  navigate(-1)
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {verifyFailure && reportMode && (
          <div className="collection-info">
            <div className="alert info" style={{ marginBottom: 10 }}>
              הדיווח יישמר על הכרטסת ויירשם על שמך.
            </div>
            <div className="kv">
              <span className="k">כתובת רשומה</span>
              <span className="v">{formatAddress(verifyFailure.card)}</span>
            </div>
            {reportError && (
              <div className="alert red" style={{ marginTop: 10 }}>{reportError}</div>
            )}
            <div className="field" style={{ marginTop: 10 }}>
              <label>פרטי הדיווח (חובה)</label>
              <textarea
                rows={4}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder='לדוגמה: כתובת שגויה: הקופה ברחוב X ולא Y'
                disabled={reportSubmitting}
              />
            </div>
            <div className="collection-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn-block"
                disabled={reportSubmitting || reportText.trim().length <= REPORT_PREFIX.trim().length}
                onClick={submitInlineReport}
              >
                {reportSubmitting ? 'שולח...' : '✓ צור דיווח והמשך לסריקה'}
              </button>
              <button
                type="button"
                className="btn-block secondary"
                disabled={reportSubmitting}
                onClick={() => {
                  setReportMode(false)
                  setReportError(null)
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </Modal>
    )
  }

  if (!cardId) {
    const disabled = lookupLoading || !boxNumberInput.trim()
    const busy = lookupLoading || verifying
    const lookupButtonLabel = lookupLoading
      ? 'מחפש...'
      : verifying ? 'מאמת מיקום...' : '💰 בצע גביה'
    return (
      <div>
        <div className="collection-card">
          <h2>אחזור קופה</h2>
          <div className="sub">הזן מספר קופה ובחר פעולה</div>
          <form
            onSubmit={lookupAndVerify}
            className="collection-info"
          >
            <div className="field">
              <label>מספר קופה</label>
              <input
                type="text"
                inputMode="numeric"
                value={boxNumberInput}
                onChange={(e) => setBoxNumberInput(e.target.value)}
                placeholder="לדוגמה: 1001"
                disabled={busy}
                autoFocus
              />
            </div>
            {lookupError && (
              <div className="alert red" style={{ marginTop: 8 }}>{lookupError}</div>
            )}
            <div className="collection-actions" style={{ marginTop: 12 }}>
              <button
                type="submit"
                className="btn-block"
                disabled={disabled || verifying}
              >
                {lookupButtonLabel}
              </button>
              <button
                type="button"
                className="btn-block secondary"
                disabled={busy || !boxNumberInput.trim()}
                onClick={(e) => lookupAndGo((id) => `/report/${id}`, e)}
              >
                📝 צור דיווח
              </button>
              <button
                type="button"
                className="btn-block secondary"
                disabled={busy || !boxNumberInput.trim()}
                onClick={(e) => lookupAndGo((id) => `/collection/${id}`, e)}
              >
                📋 הצג פרטים
              </button>
            </div>
          </form>
        </div>

        {renderVerificationModals()}
      </div>
    )
  }

  if (loading) return <div className="loading">טוען...</div>
  if (error) return <div className="alert red">{error}</div>
  if (!card) return <div className="empty">לא נמצאה כרטסת</div>

  const title = card.custom_name || `קופה ${cardLabel}`

  return (
    <div>
      <div className="collection-card">
        <h2>{title}</h2>
        <div className="sub">#{cardLabel}</div>

        <div className="collection-info">
          <div className="kv">
            <span className="k">מספר קופה</span>
            <span className="v">{card.iron_number ?? '—'}</span>
          </div>
          <div className="kv">
            <span className="k">שם</span>
            <span className="v">{card.custom_name || '—'}</span>
          </div>
          <div className="kv">
            <span className="k">כתובת</span>
            <span className="v">{formatAddress(card)}</span>
          </div>
          <div className="kv">
            <span className="k">הערות מיקום</span>
            <span className="v">{card.location_notes || '—'}</span>
          </div>
          <div className="kv">
            <span className="k">סוג התקנה</span>
            <span className="v">{card.installation_type || '—'}</span>
          </div>
          <div className="kv">
            <span className="k">תאריך גביה אחרון</span>
            <span className="v">{formatDate(card.last_collection_at)}</span>
          </div>
        </div>

        {/* Task 61: show the card location on a map so the collector can
            visually confirm the address before scanning. Also shows for
            `neighborhood_center` (approximate centroid pin) so the collector
            at least knows the rough area — with a notice that it's not exact. */}
        {(card.geocode_status === 'ok' || card.geocode_status === 'neighborhood_center')
          && card.latitude != null && card.longitude != null && (
          <div style={{ margin: '14px 0' }}>
            {card.geocode_status === 'neighborhood_center' && (
              <div style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', padding: '6px 10px', borderRadius: 6, marginBottom: 6 }}>
                📍 מיקום משוער — מרכז השכונה (אין נתוני רחוב לכרטסת זו).
              </div>
            )}
            <MapView
              lat={Number(card.latitude)}
              lng={Number(card.longitude)}
              height={200}
              popupText={formatAddress(card)}
              interactive={false}
            />
          </div>
        )}

        <div className="collection-actions">
          <button
            type="button"
            className="btn-block"
            disabled={verifying}
            onClick={() => runVerification(card)}
          >
            {verifying ? 'מאמת מיקום...' : '💰 בצע גביה'}
          </button>
          <button
            type="button"
            className="btn-block secondary"
            onClick={() => navigate(`/report/${card.id}`)}
          >
            📝 צור דיווח
          </button>
        </div>
      </div>

      {renderVerificationModals()}

      {toast && <div className="toast success">{toast}</div>}
    </div>
  )
}
