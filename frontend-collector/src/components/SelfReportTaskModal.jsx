import React, { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@shared/components/Modal'
import LocationCombobox from './LocationCombobox'
import BoxNumberAutocomplete from './BoxNumberAutocomplete'
import {
  tasks as tasksApi,
  taskTypes as taskTypesApi,
  boxTypes as boxTypesApi,
  boxes as boxesApi,
  uploads as uploadsApi,
} from '../api/endpoints'

/**
 * Task 50: collector self-report modal.
 *
 * Lets a collector with `permissions.can_self_report_tasks=true` create a task
 * AND complete it in a single call (self_report=true). Backend forces
 * assigned_to=created_by=current user.
 *
 * Task type rules:
 *   - opens_card  → no box selection; enter iron_number + box_type + location
 *                   (a new box + card are created on the spot)
 *   - !opens_card → pick an existing box from the collector's assignments
 *   - grants_temporary_access ("גביה") → blocked server-side; not shown here
 *
 * Props:
 *   open     — boolean
 *   onClose  — () => void
 *   onSaved  — (savedTask) => void
 */
export default function SelfReportTaskModal({ open, onClose, onSaved }) {
  const [types, setTypes] = useState([])
  const [boxTypesList, setBoxTypesList] = useState([])
  const [allBoxes, setAllBoxes] = useState([])

  const [taskTypeId, setTaskTypeId] = useState('')
  const [boxId,      setBoxId]      = useState('')
  const [notes,      setNotes]      = useState('')

  // opens_card fields
  const [ironNumber, setIronNumber] = useState('')
  const [boxTypeId,  setBoxTypeId]  = useState('')
  const [newCity,         setNewCity]         = useState('')
  const [newNeighborhood, setNewNeighborhood] = useState('')
  const [newStreet,       setNewStreet]       = useState('')
  const [newBuilding,     setNewBuilding]     = useState('')
  const [newLocationNotes,setNewLocationNotes]= useState('')

  const [executionNotes, setExecutionNotes] = useState('')

  // image attachment
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef   = useRef(null)
  const cameraInputRef = useRef(null)

  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      taskTypesApi.getAll().catch(() => []),
      boxTypesApi.getAll().catch(() => []),
      boxesApi.getAll().catch(() => []),
    ]).then(([t, bt, b]) => {
      if (cancelled) return
      setTypes(Array.isArray(t) ? t : [])
      setBoxTypesList(Array.isArray(bt) ? bt : [])
      setAllBoxes(Array.isArray(b) ? b : [])
    })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    setTaskTypeId(''); setBoxId(''); setNotes('')
    setIronNumber(''); setBoxTypeId('')
    setNewCity(''); setNewNeighborhood(''); setNewStreet(''); setNewBuilding(''); setNewLocationNotes('')
    setExecutionNotes('')
    setImageFile(null); setImagePreview(null)
    setErrMsg(null); setSubmitting(false)
  }, [open])

  useEffect(() => {
    if (!imagePreview) return
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  function onPickImage(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setErrMsg('יש לבחור תמונה מסוג JPEG / PNG / WEBP')
      e.target.value = ''
      return
    }
    setErrMsg(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImageSelection() {
    setImageFile(null); setImagePreview(null)
  }

  const selectedType = useMemo(
    () => types.find(t => String(t.id) === String(taskTypeId)),
    [types, taskTypeId]
  )
  // Hide the "גביה" task type — that's a managed flow, not self-report.
  const visibleTypes = useMemo(
    () => types.filter(t => !t.grants_temporary_access),
    [types]
  )

  const opensCard = !!selectedType?.opens_card

  async function handleSubmit() {
    setErrMsg(null)
    if (!taskTypeId) return setErrMsg('יש לבחור סוג משימה')
    if (opensCard) {
      if (!ironNumber.trim()) return setErrMsg('יש להזין מספר ברזל לקופה החדשה')
      if (!boxTypeId)         return setErrMsg('יש לבחור סוג קופה')
      if (!newCity.trim())    return setErrMsg('עיר היא שדה חובה למשימת התקנה')
    } else {
      if (!boxId)             return setErrMsg('יש לבחור קופה קיימת')
    }

    setSubmitting(true)
    try {
      let uploadedPath = null
      if (imageFile) {
        const up = await uploadsApi.image(imageFile)
        uploadedPath = up?.path || null
      }

      const body = {
        task_type_id: Number(taskTypeId),
        box_id:       opensCard ? null : Number(boxId),
        notes:        notes.trim() || null,
        image_path:   uploadedPath,
        self_report:  true,
        execution_notes: executionNotes.trim() || null,
        execution_image: uploadedPath,
      }
      if (opensCard) {
        body.iron_number  = ironNumber.trim()
        body.box_type_id  = Number(boxTypeId)
        body.new_city          = newCity.trim()
        body.new_neighborhood  = newNeighborhood.trim() || null
        body.new_street        = newStreet.trim()       || null
        body.new_building      = newBuilding.trim()     || null
        body.new_location_notes= newLocationNotes.trim()|| null
      }

      const saved = await tasksApi.create(body)
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בדיווח')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="דיווח על משימה שביצעתי"
      footer={
        <>
          <div />
          <div className="actions">
            <button className="btn" type="button" onClick={onClose} disabled={submitting}>ביטול</button>
            <button className="btn success" type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'מדווח...' : '✅ דווח כמבוצעת'}
            </button>
          </div>
        </>
      }
    >
      <div className="alert info" style={{ marginBottom: 12 }}>
        ℹ️ הדיווח ייצור משימה חדשה ויסמן אותה מיד כמבוצעת.
      </div>

      <div className="modal-row">
        <div className="field">
          <label>סוג משימה *</label>
          <select
            value={taskTypeId}
            onChange={(e) => setTaskTypeId(e.target.value)}
          >
            <option value="">— בחר —</option>
            {visibleTypes.map(t => (
              <option key={t.id} value={t.id}>
                {t.icon ? `${t.icon} ` : ''}{t.name}
              </option>
            ))}
          </select>
        </div>
        {!opensCard && (
          <div className="field">
            <label>קופה *</label>
            <BoxNumberAutocomplete
              boxes={allBoxes}
              value={boxId}
              onChange={(id) => setBoxId(id === '' ? '' : String(id))}
            />
          </div>
        )}
      </div>

      {opensCard && (
        <div style={{
          background: 'var(--bg2, #f9fafb)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: 'var(--text2)', marginBottom: 8,
          }}>🆕 פרטי הקופה החדשה</div>
          <div className="modal-row">
            <div className="field">
              <label>מספר ברזל *</label>
              <input
                value={ironNumber}
                onChange={(e) => setIronNumber(e.target.value)}
                placeholder="לדוגמה: 100482"
              />
            </div>
            <div className="field">
              <label>סוג קופה *</label>
              <select
                value={boxTypeId}
                onChange={(e) => setBoxTypeId(e.target.value)}
              >
                <option value="">— בחר —</option>
                {boxTypesList.map(bt => (
                  <option key={bt.id} value={bt.id}>{bt.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{
            fontSize: 12, fontWeight: 700,
            color: 'var(--text2)', marginTop: 10, marginBottom: 8,
          }}>📍 מיקום הקופה</div>
          <div className="modal-row">
            <div className="field">
              <label>עיר *</label>
              <LocationCombobox
                level="city"
                value={newCity}
                onChange={setNewCity}
                placeholder="עיר"
              />
            </div>
            <div className="field">
              <label>שכונה</label>
              <LocationCombobox
                level="neighborhood"
                value={newNeighborhood}
                onChange={setNewNeighborhood}
                city={newCity}
                placeholder="שכונה"
              />
            </div>
          </div>
          <div className="modal-row">
            <div className="field">
              <label>רחוב</label>
              <LocationCombobox
                level="street"
                value={newStreet}
                onChange={setNewStreet}
                city={newCity}
                neighborhood={newNeighborhood}
                placeholder="רחוב"
              />
            </div>
            <div className="field">
              <label>מספר / בניין</label>
              <input
                value={newBuilding}
                onChange={(e) => setNewBuilding(e.target.value)}
                placeholder="מספר"
              />
            </div>
          </div>
          <div className="field">
            <label>הערות מיקום</label>
            <input
              value={newLocationNotes}
              onChange={(e) => setNewLocationNotes(e.target.value)}
              placeholder="ליד הכניסה, קומה..."
            />
          </div>
        </div>
      )}

      <div className="field" style={{ marginBottom: 12 }}>
        <label>הערות</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="פרטים על המשימה"
        />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>הערות ביצוע</label>
        <textarea
          rows={2}
          value={executionNotes}
          onChange={(e) => setExecutionNotes(e.target.value)}
          placeholder="מה בוצע בפועל"
        />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>תמונה (אופציונלי)</label>
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
              disabled={submitting}
            >בטל בחירה</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
          >📁 צרף קובץ</button>
          <button
            type="button"
            className="btn sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={submitting}
          >📷 צלם עכשיו</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPickImage}
          disabled={submitting}
          style={{ display: 'none' }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickImage}
          disabled={submitting}
          style={{ display: 'none' }}
        />
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}
    </Modal>
  )
}
