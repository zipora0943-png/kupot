import React, { useEffect, useMemo, useState } from 'react'
import Modal from '@shared/components/Modal'
import {
  reports as reportsApi,
  taskTypes as taskTypesApi,
  users as usersApi,
} from '../api/endpoints'
import { assetUrl } from '../utils/assetUrl'

const STATUS_OPTIONS = [
  { value: 'open',      label: 'פתוח'  },
  { value: 'converted', label: 'בטיפול' },
  { value: 'closed',    label: 'סגור'   },
]

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * View / handle a report. Two flows in one modal:
 *  (a) Save — update status / description (PUT /reports/:id)
 *  (b) Convert to task — expand the bottom section, fill type+assignee
 *      (+ optional new location for opens_card types), then submit
 *      (POST /reports/:id/convert-to-task)
 *
 * Props:
 *   open      — boolean
 *   report    — the report row (must include id, description, status, type_name, icon,
 *                                iron_number, reporter_name, created_at, task_id)
 *   onClose   — () => void
 *   onSaved   — (updatedReport) => void   — called for both save AND convert
 */
export default function ReportModal({ open, report, onClose, onSaved }) {
  const [status, setStatus]           = useState('open')
  const [description, setDescription] = useState('')

  // convert-to-task panel
  const [showConvert, setShowConvert] = useState(false)
  const [types, setTypes]             = useState([])
  const [collectors, setCollectors]   = useState([])
  const [taskTypeId, setTaskTypeId]   = useState('')
  const [assignedTo, setAssignedTo]   = useState('')
  const [closeOnConvert, setCloseOnConvert] = useState(true)
  const [newCity, setNewCity]                 = useState('')
  const [newNeighborhood, setNewNeighborhood] = useState('')
  const [newStreet, setNewStreet]             = useState('')
  const [newBuilding, setNewBuilding]         = useState('')
  const [newLocationNotes, setNewLocationNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  // Lookups (when modal opens)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      taskTypesApi.getAll().catch(() => []),
      usersApi.getAll({ role: 'collector', active: true }).catch(() => []),
    ]).then(([t, u]) => {
      if (cancelled) return
      setTypes(Array.isArray(t) ? t : [])
      setCollectors(Array.isArray(u) ? u : [])
    })
    return () => { cancelled = true }
  }, [open])

  // Reset form when (re-)opening
  useEffect(() => {
    if (!open || !report) return
    setStatus(report.status || 'open')
    setDescription(report.description || '')
    setShowConvert(false)
    setTaskTypeId('')
    setAssignedTo('')
    setCloseOnConvert(true)
    setNewCity(''); setNewNeighborhood(''); setNewStreet(''); setNewBuilding(''); setNewLocationNotes('')
    setErrMsg(null)
    setSubmitting(false)
  }, [open, report])

  const selectedType = useMemo(
    () => types.find(t => String(t.id) === String(taskTypeId)),
    [types, taskTypeId]
  )
  const needsLocation = !!selectedType?.opens_card
  const alreadyConverted = !!report?.task_id

  async function handleSaveStatus() {
    if (!report) return
    setErrMsg(null)
    setSubmitting(true)
    try {
      const patch = {}
      if (status !== report.status)              patch.status = status
      if (description !== (report.description || '')) patch.description = description
      if (Object.keys(patch).length === 0) {
        onClose?.()
        return
      }
      const saved = await reportsApi.update(report.id, patch)
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בשמירה')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConvert() {
    if (!report) return
    setErrMsg(null)
    if (!taskTypeId) {
      setErrMsg('יש לבחור סוג משימה להמרה')
      return
    }
    if (needsLocation && !newCity.trim()) {
      setErrMsg('עיר היא שדה חובה למשימה זו')
      return
    }
    const body = {
      task_type_id: Number(taskTypeId),
      assigned_to:  assignedTo ? Number(assignedTo) : null,
      close_report: !!closeOnConvert,
    }
    if (needsLocation) {
      body.new_city           = newCity.trim()
      body.new_neighborhood   = newNeighborhood.trim() || null
      body.new_street         = newStreet.trim()       || null
      body.new_building       = newBuilding.trim()     || null
      body.new_location_notes = newLocationNotes.trim()|| null
    }

    setSubmitting(true)
    try {
      const res = await reportsApi.convertToTask(report.id, body)
      // Server returns { task, report_id }. Construct the updated report locally.
      onSaved?.({
        ...report,
        status: closeOnConvert ? 'closed' : 'converted',
        task_id: res?.task?.id ?? report.task_id,
      })
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בהמרה למשימה')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={report ? `דיווח #${report.id}` : 'דיווח'}
      footer={
        <>
          {!showConvert && !alreadyConverted ? (
            <button
              className="btn warn"
              type="button"
              onClick={() => setShowConvert(true)}
              disabled={submitting}
            >🔄 המרה למשימה</button>
          ) : <div />}
          <div className="actions">
            <button
              className="btn"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >ביטול</button>
            {showConvert ? (
              <button
                className="btn warn"
                type="button"
                onClick={handleConvert}
                disabled={submitting}
              >{submitting ? 'מבצע...' : '✅ צור משימה'}</button>
            ) : (
              <button
                className="btn primary"
                type="button"
                onClick={handleSaveStatus}
                disabled={submitting}
              >{submitting ? 'שומר...' : 'שמירה'}</button>
            )}
          </div>
        </>
      }
    >
      {!report ? null : (
        <>
          {/* Read-only context */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
            background: 'var(--bg2, #f9fafb)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
            fontSize: 13,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>קופה</div>
              <div style={{ fontWeight: 600 }}>{report.iron_number || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>סוג</div>
              <div style={{ fontWeight: 600 }}>
                {report.icon ? `${report.icon} ` : ''}{report.type_name || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>גובה מדווח</div>
              <div>{report.reporter_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>תאריך</div>
              <div>{formatDate(report.created_at)}</div>
            </div>
          </div>

          {alreadyConverted && (
            <div className="alert info" style={{ marginBottom: 12 }}>
              ℹ️ דיווח זה כבר הומר למשימה #{report.task_id}
            </div>
          )}

          {report.status === 'closed' && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>סיבת סגירה</label>
              {report.closure_reason
                ? <div style={{
                    whiteSpace: 'pre-wrap',
                    padding: 10,
                    border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: 8,
                    background: 'var(--bg2, #f9fafb)',
                    minHeight: 50,
                  }}>{report.closure_reason}</div>
                : <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>לא צוינה סיבה</div>}
            </div>
          )}

          <div className="modal-row">
            <div className="field">
              <label>סטטוס</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>תיאור</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="פרטי הדיווח"
            />
          </div>

          {report.image_path && (
            <div className="field" style={{ marginBottom: 14 }}>
              <label>תמונה מצורפת</label>
              <a href={assetUrl(report.image_path)} target="_blank" rel="noopener noreferrer">
                <img
                  src={assetUrl(report.image_path)}
                  alt="תמונת דיווח"
                  style={{
                    maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                    border: '1px solid var(--border, #e5e7eb)', display: 'block',
                  }}
                />
              </a>
            </div>
          )}

          {showConvert && (
            <div style={{
              background: 'var(--accent-soft, #eff6ff)',
              border: '1px solid var(--accent, #3b82f6)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>🔄 המרה למשימה</div>

              <div className="modal-row">
                <div className="field">
                  <label>סוג משימה *</label>
                  <select
                    value={taskTypeId}
                    onChange={(e) => setTaskTypeId(e.target.value)}
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
                  <label>שיוך לטיפול</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                  >
                    <option value="">לא משויך</option>
                    {collectors.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {needsLocation && (
                <div style={{ marginTop: 6 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: 'var(--text2)', marginBottom: 6,
                  }}>📍 מיקום (לפתיחת הכרטסת החדשה)</div>
                  <div className="modal-row">
                    <div className="field">
                      <label>עיר *</label>
                      <input value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>שכונה</label>
                      <input value={newNeighborhood} onChange={(e) => setNewNeighborhood(e.target.value)} />
                    </div>
                  </div>
                  <div className="modal-row">
                    <div className="field">
                      <label>רחוב</label>
                      <input value={newStreet} onChange={(e) => setNewStreet(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>מספר</label>
                      <input value={newBuilding} onChange={(e) => setNewBuilding(e.target.value)} />
                    </div>
                  </div>
                  <div className="field">
                    <label>הערות מיקום</label>
                    <input value={newLocationNotes} onChange={(e) => setNewLocationNotes(e.target.value)} />
                  </div>
                </div>
              )}

              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', fontSize: 13, marginTop: 8,
              }}>
                <input
                  type="checkbox"
                  checked={closeOnConvert}
                  onChange={(e) => setCloseOnConvert(e.target.checked)}
                />
                סגור דיווח זה לאחר ההמרה
              </label>
            </div>
          )}

          {errMsg && <div className="alert red">{errMsg}</div>}
        </>
      )}
    </Modal>
  )
}
