import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  reports as reportsApi,
  reportTypes as reportTypesApi,
  boxes as boxesApi,
  cards as cardsApi,
  uploads as uploadsApi,
} from '../api/endpoints'
import BoxNumberAutocomplete from './BoxNumberAutocomplete'

export default function ManualReportModal({ cardId, cardLabel, onClose, onCreated }) {
  const locked = cardId != null

  const [types, setTypes] = useState([])
  const [typesLoading, setTypesLoading] = useState(true)

  // For unlocked mode: load all boxes and let the user type a kupa number.
  // The active card for the chosen box is looked up on demand — same pattern
  // as TaskModal so the UX is consistent across creation flows.
  const [allBoxes, setAllBoxes] = useState([])
  const [boxesLoading, setBoxesLoading] = useState(!locked)
  const [boxId, setBoxId] = useState('')
  const [activeCard, setActiveCard] = useState(undefined) // undefined = not yet looked up
  const [loadingCard, setLoadingCard] = useState(false)

  const [reportTypeId, setReportTypeId] = useState('')
  const [description, setDescription] = useState('')

  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef   = useRef(null)
  const cameraInputRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setTypesLoading(true)
    reportTypesApi.getAll()
      .then(d => { if (!cancelled) setTypes(Array.isArray(d) ? d : []) })
      .catch(() => { if (!cancelled) setTypes([]) })
      .finally(() => { if (!cancelled) setTypesLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (locked) return
    let cancelled = false
    setBoxesLoading(true)
    boxesApi.getAll()
      .then(d => { if (!cancelled) setAllBoxes(Array.isArray(d) ? d : []) })
      .catch(() => { if (!cancelled) setAllBoxes([]) })
      .finally(() => { if (!cancelled) setBoxesLoading(false) })
    return () => { cancelled = true }
  }, [locked])

  // Look up the active card whenever the picked box changes.
  useEffect(() => {
    if (locked) return
    if (!boxId) { setActiveCard(undefined); setLoadingCard(false); return }
    let cancelled = false
    setLoadingCard(true)
    cardsApi.getAll({ box_id: Number(boxId), status: 'active' })
      .then(rows => {
        if (cancelled) return
        const list = Array.isArray(rows) ? rows : []
        setActiveCard(list[0] || null)
      })
      .catch(() => { if (!cancelled) setActiveCard(null) })
      .finally(() => { if (!cancelled) setLoadingCard(false) })
    return () => { cancelled = true }
  }, [locked, boxId])

  useEffect(() => {
    if (!imagePreview) return
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  function onPickImage(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('יש לבחור תמונה מסוג JPEG / PNG / WEBP')
      e.target.value = ''
      return
    }
    setError(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImageSelection() {
    setImageFile(null)
    setImagePreview(null)
  }

  const activeCardAddress = useMemo(() => {
    if (!activeCard) return null
    const parts = [activeCard.city, activeCard.neighborhood, activeCard.street, activeCard.building]
      .filter(s => typeof s === 'string' && s.trim())
    return parts.join(', ') || '—'
  }, [activeCard])

  const trimmedDesc = description.trim()
  const canSubmit =
    !loading &&
    trimmedDesc.length > 0 &&
    (locked || (!!boxId && !!activeCard))

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    try {
      const cidNum = locked ? Number(cardId) : Number(activeCard.id)
      let imagePath = null
      if (imageFile) {
        const up = await uploadsApi.image(imageFile)
        imagePath = up?.path || null
      }
      const created = await reportsApi.create({
        card_id: cidNum,
        report_type_id: reportTypeId === '' ? null : Number(reportTypeId),
        description: trimmedDesc,
        image_path: imagePath,
      })
      onCreated?.(created)
      onClose?.()
    } catch (err) {
      setError(err.message || 'שגיאה ביצירת הדיווח')
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>יצירת דיווח ידני</h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        {locked ? (
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            דיווח ידני יתועד בכרטסת <strong>{cardLabel || `#${cardId}`}</strong> ויירשם על שמך.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            הקש את מספר הקופה — המערכת תאחזר את הכרטסת הפעילה אליה יירשם הדיווח.
          </p>
        )}

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        {!locked && (
          <div className="field" style={{ marginBottom: 12 }}>
            <label>מספר קופה <span style={{ color: 'var(--danger)', fontWeight: 400 }}>*</span></label>
            <BoxNumberAutocomplete
              boxes={allBoxes}
              value={boxId}
              onChange={(id) => setBoxId(id === '' ? '' : String(id))}
              disabled={loading || boxesLoading}
              placeholder={boxesLoading ? 'טוען קופות...' : 'הקש מספר קופה...'}
              autoFocus
            />
          </div>
        )}

        {!locked && boxId && (
          loadingCard ? (
            <div className="alert info" style={{ marginBottom: 12 }}>
              טוען כרטסת פעילה…
            </div>
          ) : activeCard ? (
            <div className="alert info" style={{ marginBottom: 12 }}>
              📇 כרטסת פעילה: {activeCardAddress}
            </div>
          ) : activeCard === null ? (
            <div className="alert red" style={{ marginBottom: 12 }}>
              ⛔ אין כרטסת פעילה לקופה זו — לא ניתן ליצור דיווח
            </div>
          ) : null
        )}

        <div className="field" style={{ marginBottom: 12 }}>
          <label>סוג דיווח <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
          <select
            value={reportTypeId}
            onChange={(e) => setReportTypeId(e.target.value)}
            disabled={loading || typesLoading}
          >
            <option value="">{typesLoading ? 'טוען סוגים...' : '— ללא סוג —'}</option>
            {types.map(t => (
              <option key={t.id} value={t.id}>
                {t.icon ? `${t.icon} ` : ''}{t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>
            תיאור{' '}
            <span style={{ color: 'var(--danger)', fontWeight: 400 }}>(חובה)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="פרטי הדיווח..."
            disabled={loading}
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label>תמונה מצורפת (אופציונלי)</label>
          {imagePreview && (
            <div style={{ marginBottom: 8 }}>
              <img
                src={imagePreview}
                alt="תצוגה מקדימה"
                style={{
                  maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                  border: '1px solid var(--border, #e5e7eb)', display: 'block',
                }}
              />
              <button
                type="button"
                className="btn sm"
                style={{ marginTop: 6 }}
                onClick={clearImageSelection}
                disabled={loading}
              >בטל בחירה</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >📁 צרף קובץ</button>
            <button
              type="button"
              className="btn sm"
              onClick={() => cameraInputRef.current?.click()}
              disabled={loading}
            >📷 צלם עכשיו</button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPickImage}
            disabled={loading}
            style={{ display: 'none' }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPickImage}
            disabled={loading}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            JPEG / PNG / WEBP, עד 5MB
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>ביטול</button>
          <button
            className="btn success"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? 'יוצר...' : '➕ צור דיווח'}
          </button>
        </div>
      </div>
    </div>
  )
}
