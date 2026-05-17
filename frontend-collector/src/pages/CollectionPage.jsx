import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Geolocation } from '@capacitor/geolocation'
import { cards as cardsApi, locationOverrides as overridesApi } from '../api/endpoints'
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

  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [boxNumberInput, setBoxNumberInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [confirmCard, setConfirmCard] = useState(null)

  // Task 58 — GPS verification state
  const [verifying, setVerifying] = useState(false)
  const [geoUnavailable, setGeoUnavailable] = useState(null) // { card, message }
  const [radiusWarning, setRadiusWarning] = useState(null)   // { card, distance, lat, lng }
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)

  const [toast, setToast] = useState(null)

  useEffect(() => {
    const t = location.state?.toast
    if (!t) return
    setToast(t)
    navigate(location.pathname, { replace: true, state: {} })
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    if (!cardId) {
      setCard(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    cardsApi.get(cardId)
      .then((data) => { if (!cancelled) setCard(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'שגיאה בטעינת הכרטסת') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cardId])

  const cardLabel = useMemo(() => {
    if (!card) return ''
    const labels = computeCardLabels([card])
    return labels.get(card.id) || String(card.iron_number ?? '')
  }, [card])

  // Run the GPS check before navigating to the scanner.
  // GPS verification is the primary path; the address-confirmation modal is
  // only shown as a fallback when verification cannot be performed.
  //
  // source: 'lookup'  → manual box-number entry; user hasn't seen the address yet,
  //                     so fall back to the address-confirmation modal.
  // source: 'in-card' → user is already on /collection/:cardId and sees the address;
  //                     fall back to a smaller "couldn't verify, continue?" prompt
  //                     when GPS fails, and proceed straight to scan when the card
  //                     has no stored coordinates (no value in re-showing the page).
  async function runVerification(targetCard, source) {
    if (!targetCard) return
    setVerifying(true)
    try {
      const pos = await getDevicePosition()
      if (!pos.ok) {
        if (source === 'lookup') {
          setConfirmCard(targetCard)
        } else {
          setGeoUnavailable({ card: targetCard, message: pos.error })
        }
        return
      }
      let result
      try {
        result = await cardsApi.verifyLocation(targetCard.id, pos.lat, pos.lng)
      } catch (err) {
        if (source === 'lookup') {
          setConfirmCard(targetCard)
        } else {
          setGeoUnavailable({ card: targetCard, message: err?.message || 'verify_failed' })
        }
        return
      }

      if (result.within_radius) {
        navigate(`/scan/${targetCard.id}`)
        return
      }

      if (!result.card_geocoded) {
        // No coordinates for this card — verification couldn't be performed.
        if (source === 'lookup') {
          setConfirmCard(targetCard)
        } else {
          navigate(`/scan/${targetCard.id}`)
        }
        return
      }

      // Outside radius — prompt for a reason.
      setRadiusWarning({
        card: targetCard,
        distance: result.distance_meters ?? null,
        lat: pos.lat,
        lng: pos.lng,
      })
      setOverrideReason('')
    } finally {
      setVerifying(false)
    }
  }

  async function submitOverride() {
    if (!radiusWarning) return
    const reason = overrideReason.trim()
    if (reason.length < 5) return
    setOverrideSubmitting(true)
    try {
      try {
        await overridesApi.create({
          card_id: radiusWarning.card.id,
          distance_meters: radiusWarning.distance,
          reason,
          gps_lat: radiusWarning.lat,
          gps_lng: radiusWarning.lng,
        })
      } catch (err) {
        // Don't block collection if the audit log call failed; just warn in console.
        console.warn('[location-override] save failed', err.message)
      }
      const id = radiusWarning.card.id
      setRadiusWarning(null)
      navigate(`/scan/${id}`)
    } finally {
      setOverrideSubmitting(false)
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
      await runVerification(full || found, 'lookup')
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

  // Shared sub-modals (rendered alongside both view branches below).
  function renderVerificationModals() {
    return (
      <>
        <Modal
          open={!!geoUnavailable}
          title="לא ניתן לאמת מיקום"
          onClose={() => setGeoUnavailable(null)}
        >
          {geoUnavailable && (
            <div className="collection-info">
              <div className="alert info" style={{ marginBottom: 10 }}>
                לא הצלחנו לקבל את המיקום שלך מהמכשיר.<br/>
                מומלץ לאפשר הרשאת מיקום באפליקציה. ניתן להמשיך גם בלי אימות.
              </div>
              <div className="collection-actions">
                <button
                  type="button"
                  className="btn-block"
                  onClick={() => {
                    const id = geoUnavailable.card.id
                    setGeoUnavailable(null)
                    navigate(`/scan/${id}`)
                  }}
                >
                  המשך בכל זאת
                </button>
                <button
                  type="button"
                  className="btn-block secondary"
                  onClick={() => setGeoUnavailable(null)}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={!!radiusWarning}
          title="אתה רחוק מהכתובת הרשומה"
          onClose={overrideSubmitting ? undefined : () => setRadiusWarning(null)}
        >
          {radiusWarning && (
            <div className="collection-info">
              <div className="alert red" style={{ marginBottom: 10 }}>
                המיקום שלך רחוק כ-<b>{radiusWarning.distance ?? '—'}</b> מ' מהכתובת
                הרשומה של הקופה.
              </div>
              <div className="kv">
                <span className="k">כתובת רשומה</span>
                <span className="v">{formatAddress(radiusWarning.card)}</span>
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label>סיבה להמשך גביה (חובה)</label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="לדוגמה: ניסיון איתור הקופה, הגעה מוקדמת, GPS לא מדויק..."
                  disabled={overrideSubmitting}
                />
              </div>
              <div className="collection-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-block"
                  disabled={overrideReason.trim().length < 5 || overrideSubmitting}
                  onClick={submitOverride}
                >
                  {overrideSubmitting ? 'שומר...' : 'המשך לגביה בכל זאת'}
                </button>
                <button
                  type="button"
                  className="btn-block secondary"
                  disabled={overrideSubmitting}
                  onClick={() => setRadiusWarning(null)}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </Modal>
      </>
    )
  }

  if (!cardId) {
    const disabled = lookupLoading || !boxNumberInput.trim()
    const confirmAddress = confirmCard ? formatAddress(confirmCard) : ''
    const confirmLabels = confirmCard ? computeCardLabels([confirmCard]) : null
    const confirmLabel = confirmCard
      ? (confirmLabels?.get(confirmCard.id) || String(confirmCard.iron_number ?? ''))
      : ''
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

        <Modal
          open={!!confirmCard}
          title="אישור כתובת הקופה"
          onClose={() => setConfirmCard(null)}
        >
          {confirmCard && (
            <div className="collection-info">
              <div className="alert info" style={{ marginBottom: 10 }}>
                לא הצלחנו לאמת את המיקום שלך מול הכתובת.<br/>
                בדוק שהפרטים נכונים לפני המשך הגביה.
              </div>
              <div className="kv">
                <span className="k">מספר קופה</span>
                <span className="v">{confirmCard.iron_number ?? confirmLabel}</span>
              </div>
              <div className="kv">
                <span className="k">שם</span>
                <span className="v">{confirmCard.custom_name || '—'}</span>
              </div>
              <div className="kv">
                <span className="k">כתובת</span>
                <span className="v">{confirmAddress}</span>
              </div>
              {confirmCard.location_notes && (
                <div className="kv">
                  <span className="k">הערות מיקום</span>
                  <span className="v">{confirmCard.location_notes}</span>
                </div>
              )}
              <div className="collection-actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn-block"
                  onClick={() => {
                    const id = confirmCard.id
                    setConfirmCard(null)
                    navigate(`/scan/${id}`)
                  }}
                >
                  ✓ אשר והמשך לגביה
                </button>
                <button
                  type="button"
                  className="btn-block secondary"
                  onClick={() => {
                    const id = confirmCard.id
                    setConfirmCard(null)
                    navigate(`/report/${id}?reason=address`)
                  }}
                >
                  📝 דיווח כתובת לא נכונה
                </button>
              </div>
            </div>
          )}
        </Modal>

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
            <span className="k">תאריך גביה אחרון</span>
            <span className="v">{formatDate(card.last_collection_at)}</span>
          </div>
        </div>

        {/* Task 61: show the card location on a map so the collector can
            visually confirm the address before scanning. */}
        {card.geocode_status === 'ok' && card.latitude != null && card.longitude != null && (
          <div style={{ margin: '14px 0' }}>
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
            onClick={() => runVerification(card, 'in-card')}
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
