import React, { useEffect, useState } from 'react'
import Modal from '@shared/components/Modal'
import { cities as citiesApi, districts as districtsApi } from '../api/endpoints'

/**
 * Edit / create a city — name + optional district (free text via datalist of
 * existing district names so the admin can either pick or invent one).
 *
 * Props:
 *   open      — boolean
 *   item      — present → edit; absent → create
 *   prefillName — string (used when creating from "unassigned cities" alert)
 *   onClose   — () => void
 *   onSaved   — (saved) => void
 *   onDeleted — (id) => void
 */
export default function CityModal({ open, item, prefillName, onClose, onSaved, onDeleted }) {
  const isEdit = !!item

  const [name, setName] = useState('')
  const [district, setDistrict] = useState('')
  const [alertDays, setAlertDays] = useState('')
  const [knownDistricts, setKnownDistricts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    setErrMsg(null); setSubmitting(false)
    setName(isEdit ? (item.name || '') : (prefillName || ''))
    setDistrict(isEdit ? (item.district || '') : '')
    setAlertDays(isEdit && item.alert_days != null ? String(item.alert_days) : '')
    districtsApi.getAll()
      .then(list => setKnownDistricts(Array.isArray(list) ? list : []))
      .catch(() => setKnownDistricts([]))
  }, [open, isEdit, item, prefillName])

  async function handleSave() {
    setErrMsg(null)
    if (!name.trim()) return setErrMsg('יש להזין שם עיר')
    if (alertDays !== '') {
      const n = Number.parseInt(alertDays, 10)
      if (!Number.isInteger(n) || n < 1 || n > 3650)
        return setErrMsg('טווח התראה חייב להיות מספר שלם בין 1 ל-3650 (או ריק לברירת מחדל)')
    }
    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        district: district.trim() || null,
        alert_days: alertDays === '' ? null : Number.parseInt(alertDays, 10),
      }
      const saved = isEdit
        ? await citiesApi.update(item.id, body)
        : await citiesApi.create(body)
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בשמירה')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    if (!window.confirm(`למחוק את העיר "${item.name}" מטבלת ההגדרות?\n(כרטסות עם עיר זו לא נמחקות.)`)) return
    setErrMsg(null)
    setSubmitting(true)
    try {
      await citiesApi.remove(item.id)
      onDeleted?.(item.id)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה במחיקה')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={isEdit ? 'עריכת עיר' : 'עיר חדשה'}
      footer={
        <>
          {isEdit ? (
            <button
              className="btn sm"
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              style={{ color: 'var(--red)' }}
            >מחיקה</button>
          ) : <div />}
          <div className="actions">
            <button className="btn" type="button" onClick={onClose} disabled={submitting}>ביטול</button>
            <button className="btn primary" type="button" onClick={handleSave} disabled={submitting}>
              {submitting ? 'שומר...' : 'שמירה'}
            </button>
          </div>
        </>
      }
    >
      <div className="field" style={{ marginBottom: 12 }}>
        <label>שם העיר *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: בני ברק" autoFocus />
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>מחוז</label>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="למשל: מרכז (אפשר להשאיר ריק)"
          list="known-districts"
        />
        <datalist id="known-districts">
          {knownDistricts.map(d => <option key={d} value={d} />)}
        </datalist>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          טקסט חופשי. שמות מחוז קיימים מוצעים אוטומטית.
        </div>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>ימים ללא גביה להתראה <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(לעיר זו)</span></label>
        <input
          type="number"
          min="1"
          max="3650"
          value={alertDays}
          onChange={(e) => setAlertDays(e.target.value)}
          placeholder="ברירת מחדל — גלובלי"
          style={{ width: 160 }}
        />
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          גובר על ההגדרה הגלובלית. סף אישי בכרטסת גובר על שניהם
          (היררכיה: גלובלי → עיר → קופה). ריק = ירושה מהגלובלי.
        </div>
      </div>

      {errMsg && <div className="alert red">{errMsg}</div>}
    </Modal>
  )
}
