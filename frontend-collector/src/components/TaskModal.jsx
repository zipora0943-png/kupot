import React, { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import BoxNumberAutocomplete from './BoxNumberAutocomplete'
import {
  tasks as tasksApi,
  boxes as boxesApi,
  users as usersApi,
  taskTypes as taskTypesApi,
  cards as cardsApi,
  uploads as uploadsApi,
} from '../api/endpoints'
import { assetUrl } from '../utils/assetUrl'

/**
 * Create or edit a task. Mirrors frontend-admin/src/components/TaskModal.jsx
 * so the collector app's admin user gets the same authoring experience.
 *
 * Props:
 *   open      — boolean
 *   task      — when present → edit mode (PUT); otherwise → create mode (POST)
 *   defaults  — optional prefill for create mode: { box_id, task_type_id, lockBox, lockType }
 *   onClose   — () => void
 *   onSaved   — (savedTaskFromServer) => void
 */
export default function TaskModal({ open, task, defaults, onClose, onSaved }) {
  const isEdit = !!task

  const [types, setTypes] = useState([])
  const [allBoxes, setAllBoxes] = useState([])
  const [collectors, setCollectors] = useState([])

  const [taskTypeId, setTaskTypeId] = useState('')
  const [boxId,      setBoxId]      = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [notes,      setNotes]      = useState('')

  const [existingImage, setExistingImage] = useState(null)
  const [imageFile,     setImageFile]     = useState(null)
  const [imagePreview,  setImagePreview]  = useState(null)
  const [removeImage,   setRemoveImage]   = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const [activeCard, setActiveCard] = useState(undefined)
  const [loadingCard, setLoadingCard] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      taskTypesApi.getAll().catch(() => []),
      boxesApi.getAll().catch(() => []),
      usersApi.getAll({ role: 'collector', active: true }).catch(() => []),
    ]).then(([t, b, u]) => {
      if (cancelled) return
      setTypes(Array.isArray(t) ? t : [])
      setAllBoxes(Array.isArray(b) ? b : [])
      setCollectors(Array.isArray(u) ? u : [])
    })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    setErrMsg(null)
    setSubmitting(false)
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(false)
    if (isEdit) {
      setTaskTypeId(String(task.task_type_id ?? ''))
      setBoxId(String(task.box_id ?? ''))
      setAssignedTo(task.assigned_to != null ? String(task.assigned_to) : '')
      setNotes(task.notes || '')
      setExistingImage(task.image_path || null)
    } else {
      setTaskTypeId(defaults?.task_type_id != null ? String(defaults.task_type_id) : '')
      setBoxId(defaults?.box_id != null ? String(defaults.box_id) : '')
      setAssignedTo('')
      setNotes('')
      setExistingImage(null)
    }
  }, [open, isEdit, task, defaults])

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
    setRemoveImage(false)
  }

  function clearImageSelection() {
    setImageFile(null)
    setImagePreview(null)
  }

  const selectedType = useMemo(
    () => types.find(t => String(t.id) === String(taskTypeId)),
    [types, taskTypeId]
  )

  const requiresActiveCard = !!selectedType && !selectedType.opens_card

  useEffect(() => {
    if (!open || isEdit) return
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
  }, [open, isEdit, boxId])

  const activeCardAddress = useMemo(() => {
    if (!activeCard) return null
    const parts = [activeCard.city, activeCard.neighborhood, activeCard.street, activeCard.building]
      .filter(s => typeof s === 'string' && s.trim())
    return parts.join(', ') || '—'
  }, [activeCard])

  const lifecycleHint = useMemo(() => {
    if (!selectedType) return null
    const o = !!selectedType.opens_card, c = !!selectedType.closes_card
    if (o && c) return '🔄 בעת אישור ביצוע: סגירת הכרטסת הקיימת ופתיחת חדשה — יידרש מיקום מדויק'
    if (o)      return '📍 בעת אישור ביצוע: יידרש מיקום מדויק לפתיחת כרטסת חדשה'
    if (c)      return '🗑️ בעת אישור ביצוע: סגירת הכרטסת הפעילה (הקופה תישאר במלאי)'
    return 'ℹ️ בעת אישור ביצוע: ייווצר אירוע ביצוע על הכרטסת הפעילה'
  }, [selectedType])

  const grantsTempAccess = !!selectedType?.grants_temporary_access

  const lockBox  = !!defaults?.lockBox  && !isEdit
  const lockType = !!defaults?.lockType && !isEdit

  const blockedByMissingCard = !isEdit && requiresActiveCard && activeCard === null

  async function handleSubmit() {
    setErrMsg(null)
    if (!taskTypeId)          return setErrMsg('יש לבחור סוג משימה')
    if (!boxId)               return setErrMsg('יש לבחור קופה')
    if (blockedByMissingCard) return setErrMsg('אין כרטסת פעילה לקופה זו — לא ניתן ליצור משימה מסוג זה')
    if (grantsTempAccess && !isEdit && !assignedTo) {
      return setErrMsg('משימת גביה דורשת הקצאה לגובה — חובה לבחור משויך')
    }

    setSubmitting(true)
    try {
      let uploadedPath = null
      if (imageFile) {
        const up = await uploadsApi.image(imageFile)
        uploadedPath = up?.path || null
      }

      let saved
      if (isEdit) {
        const patch = {
          assigned_to: assignedTo ? Number(assignedTo) : null,
          notes:       notes.trim() || null,
        }
        if (uploadedPath)        patch.image_path = uploadedPath
        else if (removeImage)    patch.image_path = null
        saved = await tasksApi.update(task.id, patch)
      } else {
        const body = {
          task_type_id: Number(taskTypeId),
          box_id:       Number(boxId),
          assigned_to:  assignedTo ? Number(assignedTo) : null,
          notes:        notes.trim() || null,
          image_path:   uploadedPath,
        }
        saved = await tasksApi.create(body)
      }
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בשמירה')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={isEdit ? `עריכת משימה #${task?.id}` : 'משימה חדשה'}
      footer={
        <>
          <div />
          <div className="actions">
            <button
              className="btn"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >ביטול</button>
            <button
              className="btn primary"
              type="button"
              onClick={handleSubmit}
              disabled={submitting || blockedByMissingCard}
            >{submitting ? 'שומר...' : 'שמירה'}</button>
          </div>
        </>
      }
    >
      <div className="modal-row">
        <div className="field">
          <label>סוג משימה *</label>
          <select
            value={taskTypeId}
            onChange={(e) => setTaskTypeId(e.target.value)}
            disabled={lockType || isEdit}
          >
            <option value="">— בחר —</option>
            {types.map(t => (
              <option key={t.id} value={t.id}>
                {t.icon ? `${t.icon} ` : ''}{t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>קופה *</label>
          <BoxNumberAutocomplete
            boxes={allBoxes}
            value={boxId}
            onChange={(id) => setBoxId(id === '' ? '' : String(id))}
            disabled={lockBox || isEdit}
          />
        </div>
      </div>

      <div className="modal-row">
        <div className="field">
          <label>משויך{grantsTempAccess && !isEdit ? ' *' : ''}</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">{grantsTempAccess && !isEdit ? '— בחר —' : 'לא משויך'}</option>
            {collectors.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!isEdit && boxId && (
        loadingCard ? (
          <div className="alert info" style={{ marginBottom: 12 }}>
            טוען כרטסת פעילה…
          </div>
        ) : activeCard ? (
          <div className="alert info" style={{ marginBottom: 12 }}>
            📇 כרטסת פעילה: {activeCardAddress}
          </div>
        ) : activeCard === null ? (
          <div
            className={`alert ${requiresActiveCard ? 'red' : 'warn'}`}
            style={{ marginBottom: 12 }}
          >
            {requiresActiveCard
              ? '⛔ אין כרטסת פעילה לקופה זו — לא ניתן ליצור משימה מסוג זה'
              : 'ℹ️ אין כרטסת פעילה לקופה זו — תיפתח חדשה בעת ביצוע המשימה'}
          </div>
        ) : null
      )}

      {lifecycleHint && (
        <div className="alert info" style={{ marginBottom: 12 }}>
          {lifecycleHint}
        </div>
      )}

      {grantsTempAccess && !isEdit && (
        <div className="alert warn" style={{ marginBottom: 12 }}>
          🎯 משימת גביה: הגובה המשויך יקבל גישה זמנית לקופה זו (גם אם היא אינה באזור שלו) עד לאישור המשימה כמבוצעת.
        </div>
      )}

      <div className="field" style={{ marginBottom: 12 }}>
        <label>הערות / מיקום מבוקש</label>
        <textarea
          rows={3}
          placeholder="פרטים נוספים, מיקום רצוי..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>תמונה מצורפת (אופציונלי)</label>
        {imagePreview ? (
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
        ) : isEdit && existingImage && !removeImage ? (
          <div style={{ marginBottom: 8 }}>
            <a href={assetUrl(existingImage)} target="_blank" rel="noopener noreferrer">
              <img
                src={assetUrl(existingImage)}
                alt="תמונה מצורפת"
                style={{
                  maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                  border: '1px solid var(--border, #e5e7eb)', display: 'block',
                }}
              />
            </a>
            <button
              type="button"
              className="btn sm"
              style={{ marginTop: 6 }}
              onClick={() => setRemoveImage(true)}
              disabled={submitting}
            >הסר תמונה</button>
          </div>
        ) : isEdit && existingImage && removeImage ? (
          <div className="alert warn" style={{ marginBottom: 8 }}>
            התמונה הנוכחית תוסר בעת שמירה.{' '}
            <button
              type="button"
              className="btn sm"
              onClick={() => setRemoveImage(false)}
              disabled={submitting}
            >ביטול</button>
          </div>
        ) : null}
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
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          JPEG / PNG / WEBP, עד 5MB
        </div>
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}

      {isEdit && (
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          * סוג משימה וקופה אינם ניתנים לשינוי לאחר היצירה
        </div>
      )}
    </Modal>
  )
}
