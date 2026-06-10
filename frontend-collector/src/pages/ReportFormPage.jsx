import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  reports as reportsApi,
  uploads as uploadsApi,
} from '../api/endpoints'
import { useData } from '@shared/context/DataStoreContext'

export default function ReportFormPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reason = searchParams.get('reason')

  // Report types come from the central store (auto-refreshes via socket when
  // admin adds a new type — used to come from /api/initial-load which only
  // ran once at login and got stale).
  const { data: typesFromStore, refetch: refetchReportTypes } = useData('reportTypes')
  const types = useMemo(
    () => (Array.isArray(typesFromStore) ? typesFromStore : []),
    [typesFromStore],
  )
  const typesLoading = typesFromStore == null

  useEffect(() => {
    refetchReportTypes()
  }, [refetchReportTypes])

  const [reportTypeId, setReportTypeId] = useState('')
  const [description, setDescription] = useState(
    reason === 'address' ? 'כתובת שגויה: ' : ''
  )

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  // Camera is the Android system camera (via <input capture>). The custom
  // in-app getUserMedia camera was crashing the WebView on this build, so
  // we stay on the system-intent path that the user reported as reliable.
  const cameraInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!imagePreview) return
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  function onPickImage(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!/^image\//.test(file.type)) {
      setError('יש לבחור קובץ תמונה')
      e.target.value = ''
      return
    }
    setError(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const trimmedDesc = description.trim()
  const canSubmit = !submitting && trimmedDesc.length > 0

  async function handleSubmit(e) {
    e?.preventDefault?.()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      let imagePath = null
      if (imageFile) {
        const up = await uploadsApi.image(imageFile)
        imagePath = up?.path || null
      }
      await reportsApi.create({
        card_id: Number(cardId),
        report_type_id: reportTypeId === '' ? null : Number(reportTypeId),
        description: trimmedDesc,
        image_path: imagePath,
      })
      navigate(`/collection/${cardId}`, {
        state: { toast: 'הדיווח נוצר בהצלחה' },
      })
    } catch (err) {
      setError(err?.message || 'שגיאה ביצירת הדיווח')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="collection-card">
        <h2>יצירת דיווח</h2>
        <div className="sub">דיווח ידני יתועד על הכרטסת ויירשם על שמך</div>

        {error && <div className="alert red" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>סוג דיווח (אופציונלי)</label>
            <select
              value={reportTypeId}
              onChange={(e) => setReportTypeId(e.target.value)}
              disabled={submitting || typesLoading}
            >
              <option value="">{typesLoading ? 'טוען סוגים...' : '— ללא סוג —'}</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon ? `${t.icon} ` : ''}{t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>תיאור (חובה)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="פרטי הדיווח..."
              disabled={submitting}
              style={{ minHeight: 100 }}
            />
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>צילום (אופציונלי)</label>
            {imagePreview && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={imagePreview}
                  alt="תצוגה מקדימה"
                  style={{
                    maxWidth: '100%', maxHeight: 220, borderRadius: 8,
                    border: '1px solid var(--border)', display: 'block',
                  }}
                />
                <button
                  type="button"
                  className="btn sm"
                  style={{ marginTop: 6 }}
                  onClick={clearImage}
                  disabled={submitting}
                >בטל בחירה</button>
              </div>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickImage}
              disabled={submitting}
              style={{ display: 'none' }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickImage}
              disabled={submitting}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-block secondary"
                onClick={() => cameraInputRef.current?.click()}
                disabled={submitting}
              >
                📷 צלם
              </button>
              <button
                type="button"
                className="btn-block secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                📁 בחר קובץ
              </button>
            </div>
          </div>

          <div className="collection-actions">
            <button
              type="submit"
              className="btn-block"
              disabled={!canSubmit}
            >
              {submitting ? 'יוצר...' : '➕ צור דיווח'}
            </button>
            <button
              type="button"
              className="btn-block secondary"
              onClick={() => navigate(`/collection/${cardId}`)}
              disabled={submitting}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
