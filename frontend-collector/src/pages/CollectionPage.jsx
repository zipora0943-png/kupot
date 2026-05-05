import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cards as cardsApi } from '../api/endpoints'

export default function CollectionPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()

  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [boxNumberInput, setBoxNumberInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)

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

  return (
    <div>
      <div className="collection-card">
        <h2>קופה #{card.iron_number}</h2>
        <div className="sub">{card.custom_name || ''}</div>
      </div>
    </div>
  )
}
