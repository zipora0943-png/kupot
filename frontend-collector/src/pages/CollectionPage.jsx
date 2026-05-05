import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { cards as cardsApi, envelopes as envelopesApi } from '../api/endpoints'
import { computeCardLabels } from '../utils/cardLabel'

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatDateTime(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('he-IL', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
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

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

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

  useEffect(() => {
    if (!cardId) {
      setHistory([])
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    envelopesApi.getAll({ card_id: Number(cardId), limit: 5 })
      .then((rows) => {
        if (cancelled) return
        setHistory(Array.isArray(rows) ? rows : [])
      })
      .catch(() => { if (!cancelled) setHistory([]) })
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [cardId, location.key])

  const cardLabel = useMemo(() => {
    if (!card) return ''
    const labels = computeCardLabels([card])
    return labels.get(card.id) || String(card.iron_number ?? '')
  }, [card])

  async function handleLookup(e) {
    e?.preventDefault?.()
    const num = boxNumberInput.trim()
    if (!num) return
    setLookupError(null)
    setLookupLoading(true)
    try {
      const rows = await cardsApi.getAll({ iron_number: num, status: 'active' })
      const list = Array.isArray(rows) ? rows : []
      const found = list[0]
      if (!found) {
        setLookupError('לא נמצאה כרטסת פעילה לקופה זו')
        return
      }
      navigate(`/collection/${found.id}`)
    } catch (err) {
      setLookupError(err.message || 'שגיאה באחזור הקופה')
    } finally {
      setLookupLoading(false)
    }
  }

  if (!cardId) {
    return (
      <div>
        <div className="collection-card">
          <h2>אחזור קופה</h2>
          <div className="sub">הזן מספר קופה כדי להתחיל גביה</div>
          <form onSubmit={handleLookup} className="collection-info">
            <div className="field">
              <label>מספר קופה</label>
              <input
                type="text"
                inputMode="numeric"
                value={boxNumberInput}
                onChange={(e) => setBoxNumberInput(e.target.value)}
                placeholder="לדוגמה: 1019"
                disabled={lookupLoading}
                autoFocus
              />
            </div>
            {lookupError && (
              <div className="alert red" style={{ marginTop: 8 }}>{lookupError}</div>
            )}
            <button
              type="submit"
              className="btn-block"
              disabled={lookupLoading || !boxNumberInput.trim()}
              style={{ marginTop: 12 }}
            >
              {lookupLoading ? 'מחפש...' : 'אחזר'}
            </button>
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

      <div className="envelopes-history">
        <h3>5 מעטפות אחרונות</h3>
        {historyLoading ? (
          <div className="loading" style={{ padding: 16 }}>טוען...</div>
        ) : history.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>אין מעטפות עדיין</div>
        ) : (
          history.map((env) => (
            <div key={env.id} className="envelope-row">
              <span className="num">#{env.envelope_number}</span>
              <span className="meta">{formatDateTime(env.created_at)}</span>
            </div>
          ))
        )}
      </div>

      {toast && <div className="toast success">{toast}</div>}
    </div>
  )
}
