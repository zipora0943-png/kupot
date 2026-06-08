import React, { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useData } from '@shared/context/DataStoreContext'
import { computeCardLabels } from '@shared/utils/cardLabel'
import MapView from '@shared/components/MapView'
import SelfReportTaskModal from '../components/SelfReportTaskModal'

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

/**
 * Maintenance (תחזוקה) box-detail screen. Read-only view of a card's details
 * (no collection flow) plus two actions: report a performed task on this box,
 * and create a report. Reached from the boxes list at /box/:cardId.
 */
export default function BoxDetailPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const { data: cardsList, loading } = useData('cards')
  const [reportTaskOpen, setReportTaskOpen] = useState(false)

  const card = useMemo(() => {
    if (!cardId || !Array.isArray(cardsList)) return null
    const id = Number(cardId)
    return cardsList.find((c) => Number(c.id) === id) || null
  }, [cardsList, cardId])

  const cardLabel = useMemo(() => {
    if (!card) return ''
    const labels = computeCardLabels([card])
    return labels.get(card.id) || String(card.iron_number ?? '')
  }, [card])

  if (loading) return <div className="loading">טוען...</div>
  if (!card) return <div className="empty">לא נמצאה כרטסת</div>

  const title = card.custom_name || `קופה ${cardLabel}`
  const hasMap = (card.geocode_status === 'ok' || card.geocode_status === 'neighborhood_center')
    && card.latitude != null && card.longitude != null

  return (
    <div>
      <div className="collection-card">
        <button
          type="button"
          className="btn sm"
          style={{ marginBottom: 10 }}
          onClick={() => navigate('/boxes')}
        >→ חזרה לרשימה</button>

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

        {hasMap && (
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
            onClick={() => setReportTaskOpen(true)}
          >
            📋 דווח על משימה שבוצעה
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

      <SelfReportTaskModal
        open={reportTaskOpen}
        presetBoxId={card.box_id}
        onClose={() => setReportTaskOpen(false)}
        onSaved={() => setReportTaskOpen(false)}
      />
    </div>
  )
}
