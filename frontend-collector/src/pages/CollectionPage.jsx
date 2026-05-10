import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { cards as cardsApi } from '../api/endpoints'
import { computeCardLabels } from '@shared/utils/cardLabel'

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

  if (!cardId) {
    const disabled = lookupLoading || !boxNumberInput.trim()
    return (
      <div>
        <div className="collection-card">
          <h2>אחזור קופה</h2>
          <div className="sub">הזן מספר קופה ובחר פעולה</div>
          <form
            onSubmit={(e) => lookupAndGo((id) => `/scan/${id}`, e)}
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
                disabled={lookupLoading}
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
                disabled={disabled}
              >
                {lookupLoading ? 'מחפש...' : '💰 בצע גביה'}
              </button>
              <button
                type="button"
                className="btn-block secondary"
                disabled={disabled}
                onClick={(e) => lookupAndGo((id) => `/report/${id}`, e)}
              >
                📝 צור דיווח
              </button>
              <button
                type="button"
                className="btn-block secondary"
                disabled={disabled}
                onClick={(e) => lookupAndGo((id) => `/collection/${id}`, e)}
              >
                📋 הצג פרטים
              </button>
            </div>
          </form>
        </div>
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

        <div className="collection-actions">
          <button
            type="button"
            className="btn-block"
            onClick={() => navigate(`/scan/${card.id}`)}
          >
            💰 בצע גביה
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

      {toast && <div className="toast success">{toast}</div>}
    </div>
  )
}
