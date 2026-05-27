import React, { useEffect, useState } from 'react'
import Modal from '@shared/components/Modal'
import LocationCombobox from './LocationCombobox'
import { boxes as boxesApi, boxTypes as boxTypesApi } from '../api/endpoints'

/**
 * Create or edit a box.
 * Backend create endpoint: POST /api/boxes  (admin-only)
 * Backend update endpoint: PUT  /api/boxes/:id (admin-only, partial)
 *
 * Task 49: creating a new box also opens its first card in the same
 * transaction — the box becomes 'active' immediately. So in CREATE mode
 * we collect both box-level (iron_number, box_type, notes) and card-level
 * (city/neighborhood/street/building/location_notes/installation_type/
 *  custom_name/alert_days_personal/receipt_required/receipt_details) fields.
 * `city` is required.
 *
 * Props:
 *   open    — boolean
 *   box     — present → edit; absent → create
 *   onClose — () => void
 *   onSaved — (savedBox) => void
 */
export default function BoxModal({ open, box, onClose, onSaved }) {
  const isEdit = !!box

  const [types, setTypes] = useState([])
  const [ironNumber, setIronNumber] = useState('')
  const [boxTypeId,  setBoxTypeId]  = useState('')
  const [notes,      setNotes]      = useState('')

  // Task 49: card fields (create mode only)
  const [city,             setCity]             = useState('')
  const [neighborhood,     setNeighborhood]     = useState('')
  const [street,           setStreet]           = useState('')
  const [building,         setBuilding]         = useState('')
  const [locationNotes,    setLocationNotes]    = useState('')
  const [customName,       setCustomName]       = useState('')
  const [installationType, setInstallationType] = useState('')
  const [alertDays,        setAlertDays]        = useState('')
  const [receiptRequired,  setReceiptRequired]  = useState(false)
  const [receiptDetails,   setReceiptDetails]   = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    boxTypesApi.getAll()
      .then(d => !cancelled && setTypes(Array.isArray(d) ? d : []))
      .catch(() => !cancelled && setTypes([]))
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    setErrMsg(null)
    setSubmitting(false)
    if (isEdit) {
      setIronNumber(box.iron_number || '')
      setBoxTypeId(box.box_type_id != null ? String(box.box_type_id) : '')
      setNotes(box.notes || '')
    } else {
      setIronNumber('')
      setBoxTypeId('')
      setNotes('')
      setCity('')
      setNeighborhood('')
      setStreet('')
      setBuilding('')
      setLocationNotes('')
      setCustomName('')
      setInstallationType('')
      setAlertDays('')
      setReceiptRequired(false)
      setReceiptDetails('')
    }
  }, [open, isEdit, box])

  async function handleSave() {
    setErrMsg(null)
    if (!ironNumber.trim()) return setErrMsg('מספר ברזל הוא שדה חובה')

    // Task 49: in edit mode the body remains box-only (card fields can't be
    // changed here — admin edits cards from CardDetailPage). In create mode
    // the box and card are created together; city is required.
    let body
    if (isEdit) {
      body = {
        iron_number: ironNumber.trim(),
        box_type_id: boxTypeId ? Number(boxTypeId) : null,
        notes: notes.trim() || null,
      }
    } else {
      if (!city.trim()) return setErrMsg('עיר היא שדה חובה (יוצרת גם כרטסת)')
      body = {
        iron_number:  ironNumber.trim(),
        box_type_id:  boxTypeId ? Number(boxTypeId) : null,
        notes:        notes.trim() || null,
        // card fields
        city:             city.trim(),
        neighborhood:     neighborhood.trim() || null,
        street:           street.trim()       || null,
        building:         building.trim()     || null,
        location_notes:   locationNotes.trim()|| null,
        custom_name:      customName.trim()   || null,
        installation_type: installationType.trim() || null,
        alert_days_personal: alertDays === '' ? null : Number(alertDays),
        receipt_required: !!receiptRequired,
        receipt_details:  receiptRequired ? (receiptDetails.trim() || null) : null,
      }
    }

    setSubmitting(true)
    try {
      const saved = isEdit
        ? await boxesApi.update(box.id, body)
        : await boxesApi.create(body)
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
      title={isEdit ? `עריכת קופה — ${box?.iron_number || ''}` : 'הוספת קופה + כרטסת'}
      footer={
        <>
          <div />
          <div className="actions">
            <button className="btn" type="button" onClick={onClose} disabled={submitting}>ביטול</button>
            <button className="btn primary" type="button" onClick={handleSave} disabled={submitting}>
              {submitting ? 'שומר...' : (isEdit ? 'שמירה' : 'הוספה')}
            </button>
          </div>
        </>
      }
    >
      <div className="modal-row">
        <div className="field">
          <label>מספר קופה (ברזל) *</label>
          <input
            value={ironNumber}
            onChange={(e) => setIronNumber(e.target.value)}
            placeholder="מספר ייחודי"
            autoFocus={!isEdit}
          />
        </div>
        <div className="field">
          <label>סוג קופה{!isEdit ? ' *' : ''}</label>
          <select value={boxTypeId} onChange={(e) => setBoxTypeId(e.target.value)}>
            <option value="">— ללא —</option>
            {types.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>הערות לקופה</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="אופציונלי"
        />
      </div>

      {!isEdit && (
        <>
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
            }}>📇 פרטי הכרטסת (תיפתח אוטומטית)</div>

            <div className="modal-row">
              <div className="field">
                <label>עיר *</label>
                <LocationCombobox
                  level="city"
                  value={city}
                  onChange={setCity}
                  placeholder="עיר"
                />
              </div>
              <div className="field">
                <label>שכונה</label>
                <LocationCombobox
                  level="neighborhood"
                  value={neighborhood}
                  onChange={setNeighborhood}
                  city={city}
                  placeholder="שכונה"
                />
              </div>
            </div>

            <div className="modal-row">
              <div className="field">
                <label>רחוב</label>
                <LocationCombobox
                  level="street"
                  value={street}
                  onChange={setStreet}
                  city={city}
                  neighborhood={neighborhood}
                  placeholder="רחוב"
                />
              </div>
              <div className="field">
                <label>מספר / בניין</label>
                <input
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="מספר"
                />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>הערות מיקום</label>
              <input
                value={locationNotes}
                onChange={(e) => setLocationNotes(e.target.value)}
                placeholder="ליד הכניסה, קומה..."
              />
            </div>

            <div className="modal-row">
              <div className="field">
                <label>שם מותאם <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder='למשל: "שובע שמחות"'
                />
              </div>
              <div className="field">
                <label>סוג התקנה <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(אופציונלי)</span></label>
                <input
                  value={installationType}
                  onChange={(e) => setInstallationType(e.target.value)}
                  placeholder="קיר, תקרה, עמוד..."
                />
              </div>
            </div>

            <div className="modal-row">
              <div className="field">
                <label>טווח התראה אישי <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(ימים)</span></label>
                <input
                  type="number"
                  min="1"
                  value={alertDays}
                  onChange={(e) => setAlertDays(e.target.value)}
                  placeholder="ברירת מחדל — גלובלי"
                />
              </div>
              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={receiptRequired}
                    onChange={(e) => setReceiptRequired(e.target.checked)}
                  />
                  דרוש קבלה
                </label>
                {receiptRequired && (
                  <input
                    value={receiptDetails}
                    onChange={(e) => setReceiptDetails(e.target.value)}
                    placeholder="פרטי הקבלה"
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {errMsg && <div className="alert red">{errMsg}</div>}
    </Modal>
  )
}
