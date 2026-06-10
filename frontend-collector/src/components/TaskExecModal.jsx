import React, { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@shared/components/Modal'
import LocationCombobox from './LocationCombobox'
import { tasks as tasksApi, uploads as uploadsApi } from '../api/endpoints'
import { useData } from '@shared/context/DataStoreContext'

/**
 * Confirm-execution modal for a task. Mirrors the admin TaskExecModal:
 *   opens_card  &&  closes_card → relocation
 *   opens_card  && !closes_card → installation (requires city)
 *  !opens_card  &&  closes_card → removal
 *  !opens_card  && !closes_card → generic (TASK_DONE event)
 */
export default function TaskExecModal({ open, task, onClose, onSuccess, onReportNotExecuted }) {
  const [executionNotes, setExecutionNotes] = useState('')
  const [newCity,         setNewCity]         = useState('')
  const [newNeighborhood, setNewNeighborhood] = useState('')
  const [newStreet,       setNewStreet]       = useState('')
  const [newBuilding,     setNewBuilding]     = useState('')
  const [newLocationNotes,setNewLocationNotes]= useState('')
  // Task 48: when task.box_id is NULL the installer enters the iron_number
  // and box_type now (the backend creates the box in the same transaction).
  const [ironNumber,  setIronNumber]  = useState('')
  const [boxTypeId,   setBoxTypeId]   = useState('')
  const { data: boxTypesFromStore, refetch: refetchBoxTypes } = useData('boxTypes')
  const boxTypesList = useMemo(
    () => (Array.isArray(boxTypesFromStore) ? boxTypesFromStore : []),
    [boxTypesFromStore],
  )
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  // System-camera intent: the in-app getUserMedia camera crashed the WebView,
  // so we stay on the file-input path even though it adds the OS confirm step.
  const fileInputRef   = useRef(null)
  const cameraInputRef = useRef(null)

  const needsBox = !!task && task.box_id == null

  useEffect(() => {
    if (!open || !task) return
    setExecutionNotes(task.execution_notes || '')
    setNewCity(task.new_city || '')
    setNewNeighborhood(task.new_neighborhood || '')
    setNewStreet(task.new_street || '')
    setNewBuilding(task.new_building || '')
    setNewLocationNotes(task.new_location_notes || '')
    setIronNumber('')
    setBoxTypeId('')
    setImageFile(null)
    setImagePreview(null)
    setErrMsg(null)
    setSubmitting(false)
  }, [open, task])

  useEffect(() => {
    if (!open || !needsBox) return
    // Pull fresh from the store on open in case the admin added a new box
    // type while this modal wasn't mounted.
    refetchBoxTypes()
  }, [open, needsBox, refetchBoxTypes])

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
    setImageFile(null)
    setImagePreview(null)
  }

  const flavor = useMemo(() => {
    if (!task) return null
    const o = !!task.opens_card, c = !!task.closes_card
    if (o && c) return 'transfer'
    if (o)      return 'installation'
    if (c)      return 'removal'
    return 'generic'
  }, [task])

  const needsLocation = flavor === 'transfer' || flavor === 'installation'

  const lifecycleHint = useMemo(() => {
    switch (flavor) {
      case 'transfer':     return 'סגירת הכרטסת הנוכחית + פתיחת כרטסת חדשה'
      case 'installation': return 'פתיחת כרטסת חדשה לקופה'
      case 'removal':      return 'סגירת הכרטסת (הקופה תישאר במלאי)'
      case 'generic':      return 'אירוע ביצוע יתווסף לכרטסת הפעילה (אם קיימת)'
      default: return ''
    }
  }, [flavor])

  async function handleSubmit() {
    if (!task) return
    setErrMsg(null)

    if (needsBox) {
      if (!ironNumber.trim()) return setErrMsg('יש להזין מספר ברזל לקופה')
      if (!boxTypeId)         return setErrMsg('יש לבחור סוג קופה')
    }

    if (needsLocation && !newCity.trim()) {
      setErrMsg('עיר היא שדה חובה למשימה זו')
      return
    }

    const body = {
      execution_notes: executionNotes.trim() || null,
    }
    if (needsBox) {
      body.iron_number = ironNumber.trim()
      body.box_type_id = Number(boxTypeId)
    }
    if (needsLocation) {
      body.new_city          = newCity.trim()
      body.new_neighborhood  = newNeighborhood.trim() || null
      body.new_street        = newStreet.trim()       || null
      body.new_building      = newBuilding.trim()     || null
      body.new_location_notes= newLocationNotes.trim()|| null
    }

    setSubmitting(true)
    try {
      if (imageFile) {
        const up = await uploadsApi.image(imageFile)
        body.execution_image = up?.path || null
      }
      const res = await tasksApi.complete(task.id, body)
      onSuccess?.(res?.task || null)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה באישור הביצוע')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="אישור ביצוע משימה"
      footer={
        <>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {task ? (
              task.iron_number || task.box_id
                ? <>קופה <strong>{task.iron_number || task.box_id}</strong></>
                : <>קופה חדשה (יוזן בביצוע)</>
            ) : null}
          </div>
          <div className="actions">
            <button
              className="btn"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >ביטול</button>
            {onReportNotExecuted && (
              <button
                className="btn danger"
                type="button"
                onClick={() => onReportNotExecuted(task)}
                disabled={submitting}
              >❌ לא בוצעה</button>
            )}
            <button
              className="btn success"
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'מבצע...' : '✅ אישור ביצוע'}
            </button>
          </div>
        </>
      }
    >
      {!task ? null : (
        <>
          <div style={{
            background: 'var(--bg2, #f3f4f6)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 14,
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {task.icon ? `${task.icon} ` : ''}{task.type_name}
            </div>
            <div style={{ color: 'var(--text2)' }}>{lifecycleHint}</div>
          </div>

          {needsBox && (
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
            </div>
          )}

          {needsLocation && (
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
              }}>📍 מיקום מדויק (לפתיחת הכרטסת החדשה)</div>
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
                    placeholder="מספר"
                    value={newBuilding}
                    onChange={(e) => setNewBuilding(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label>הערות מיקום</label>
                <input
                  placeholder="ליד הכניסה, קומה..."
                  value={newLocationNotes}
                  onChange={(e) => setNewLocationNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="field" style={{ marginBottom: 12 }}>
            <label>הערות ביצוע</label>
            <textarea
              rows={3}
              placeholder="מה בוצע בפועל"
              value={executionNotes}
              onChange={(e) => setExecutionNotes(e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
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
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              JPEG / PNG / WEBP, עד 5MB
            </div>
          </div>

          {errMsg && <div className="alert red">{errMsg}</div>}
        </>
      )}
    </Modal>
  )
}
