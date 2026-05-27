import React, { useEffect, useMemo, useState } from 'react'
import Modal from '@shared/components/Modal'
import LocationCombobox from './LocationCombobox'
import {
  users as usersApi,
  districts as districtsApi,
  boxTypes as boxTypesApi,
} from '../api/endpoints'
import { useAuth } from '@shared/context/AuthContext'

const ROLE_OPTIONS = [
  { value: 'admin',     label: 'מנהל' },
  { value: 'collector', label: 'גובה' },
  { value: 'cashroom',  label: 'מזין' },
]

const TAG_STYLE = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '3px 10px', marginInlineEnd: 6, marginBottom: 6,
  background: 'var(--bg2, #f3f4f6)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 14, fontSize: 12, color: 'var(--text2)',
}

const TAG_RM_STYLE = {
  cursor: 'pointer', color: 'var(--text3)',
  fontWeight: 700, lineHeight: 1,
}

// Convert a rule object → short Hebrew chip text.
// `boxTypeNames` is { [id]: name } for resolving box_type_id labels.
function ruleToLabel(rule, boxTypeNames) {
  if (!rule || typeof rule !== 'object') return null
  const typeSuffix = rule.box_type_id
    ? ` + ${boxTypeNames?.[rule.box_type_id] || `סוג #${rule.box_type_id}`}`
    : ''
  if (rule.box_id) return `קופה #${rule.box_id}${typeSuffix}`
  if (rule.building) return `${rule.street || ''} ${rule.building}`.trim() + (rule.city ? ` (${rule.city})` : '') + typeSuffix
  if (rule.street) {
    const inCity = rule.city || rule.neighborhood
    return (inCity ? `${rule.street} (${inCity})` : rule.street) + typeSuffix
  }
  if (rule.neighborhood) return `${rule.neighborhood} (שכונה)` + typeSuffix
  if (rule.city) return `${rule.city} (כל העיר)` + typeSuffix
  if (rule.district) return `${rule.district} (כל המחוז)` + typeSuffix
  if (rule.box_type_id) return boxTypeNames?.[rule.box_type_id] ? `כל ה${boxTypeNames[rule.box_type_id]}` : `סוג קופה #${rule.box_type_id}`
  return JSON.stringify(rule)
}

function buildRuleFromInputs({ district, city, neighborhood, street, building, boxId, boxTypeId }) {
  const d  = (district || '').trim()
  const c  = (city || '').trim()
  const n  = (neighborhood || '').trim()
  const s  = (street || '').trim()
  const b  = (building || '').trim()
  const bid = (boxId || '').trim()
  const bt = (boxTypeId || '').toString().trim()

  if (bid) {
    const num = Number(bid)
    if (!Number.isInteger(num)) return { error: 'מס׳ קופה חייב להיות מספר שלם' }
    const rule = { box_id: num }
    if (bt) rule.box_type_id = Number(bt)
    return { rule }
  }
  if (!d && !c && !n && !s && !b && !bt) {
    return { error: 'יש למלא לפחות מחוז / עיר / שכונה / רחוב / מס׳ קופה / סוג קופה' }
  }
  const rule = {}
  if (d) rule.district = d
  if (c) rule.city = c
  if (n) rule.neighborhood = n
  if (s) rule.street = s
  if (b) rule.building = b
  if (bt) rule.box_type_id = Number(bt)
  return { rule }
}

/**
 * Editor for one rule list (assignments OR exclusions). Lets the user add
 * rules via a row of inputs and remove them via an ✕ on each chip.
 *
 * Props additions:
 *   knownDistricts — string[] of available district names
 *   boxTypeOptions — [{ id, name }] for the box-type dropdown
 *   boxTypeNames   — { [id]: name } map for chip labels
 */
function RulesEditor({ rules, onChange, label, knownDistricts, boxTypeOptions, boxTypeNames }) {
  const [district,     setDistrict]     = useState('')
  const [city,         setCity]         = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [street,       setStreet]       = useState('')
  const [building,     setBuilding]     = useState('')
  const [boxId,        setBoxId]        = useState('')
  const [boxTypeId,    setBoxTypeId]    = useState('')
  const [err,          setErr]          = useState(null)

  function addRule() {
    setErr(null)
    const result = buildRuleFromInputs({ district, city, neighborhood, street, building, boxId, boxTypeId })
    if (result.error) { setErr(result.error); return }
    onChange([...(Array.isArray(rules) ? rules : []), result.rule])
    setDistrict(''); setCity(''); setNeighborhood(''); setStreet(''); setBuilding(''); setBoxId(''); setBoxTypeId('')
  }

  function removeAt(idx) {
    onChange(rules.filter((_, i) => i !== idx))
  }

  return (
    <div style={{
      background: 'var(--bg2, #f9fafb)',
      border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
        {label}
      </div>

      <div className="modal-row">
        <div className="field"><label>מחוז</label>
          <select value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">— (אין בחירה) —</option>
            {(knownDistricts || []).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field"><label>עיר</label>
          <LocationCombobox level="city" value={city} onChange={setCity} placeholder="ירושלים" />
        </div>
        <div className="field"><label>שכונה</label>
          <LocationCombobox level="neighborhood" value={neighborhood} onChange={setNeighborhood} city={city} placeholder="גאולה" />
        </div>
      </div>
      <div className="modal-row">
        <div className="field"><label>רחוב</label>
          <LocationCombobox level="street" value={street} onChange={setStreet} city={city} neighborhood={neighborhood} placeholder="הרב סורוצקין" />
        </div>
        <div className="field"><label>בנין</label>
          <input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="14" />
        </div>
        <div className="field"><label>מס׳ קופה (בודדת)</label>
          <input value={boxId} onChange={(e) => setBoxId(e.target.value)} placeholder="789" />
        </div>
        <div className="field"><label>סוג קופה (סינון)</label>
          <select value={boxTypeId} onChange={(e) => setBoxTypeId(e.target.value)}>
            <option value="">— (כל הסוגים) —</option>
            {(boxTypeOptions || []).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="actions" style={{ marginBottom: 8 }}>
        <button type="button" className="btn sm" onClick={addRule}>+ הוסף</button>
        {err && <span style={{ color: 'var(--red)', fontSize: 12 }}>{err}</span>}
      </div>

      <div style={{ minHeight: 28 }}>
        {(!Array.isArray(rules) || rules.length === 0) ? (
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
        ) : rules.map((r, i) => (
          <span key={i} style={TAG_STYLE}>
            {ruleToLabel(r, boxTypeNames)}
            <span
              style={TAG_RM_STYLE}
              onClick={() => removeAt(i)}
              title="הסרה"
            >✕</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Create or edit a user (admin only).
 *
 * Props:
 *   open      — boolean
 *   user      — present → edit; absent → create
 *   onClose   — () => void
 *   onSaved   — (savedUser) => void
 *   onDeactivated — (id) => void   // called after soft-delete
 */
export default function UserModal({ open, user, onClose, onSaved, onDeactivated }) {
  const isEdit = !!user
  const auth = useAuth()
  const isSelf = isEdit && auth?.user?.id === user?.id

  const [name,     setName]     = useState('')
  const [username, setUsername] = useState('')
  const [role,     setRole]     = useState('collector')
  const [active,   setActive]   = useState(true)
  const [assignments, setAssignments] = useState([])
  const [exclusions,  setExclusions]  = useState([])
  // Task 50: per-user permissions JSONB (currently only can_self_report_tasks)
  const [canSelfReportTasks, setCanSelfReportTasks] = useState(false)

  // password handling: required on create; optional toggle on edit
  const [password, setPassword] = useState('')
  const [changePw, setChangePw] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  // Lookups for rule editing — districts (free-text list from cities table)
  // and box types (id+name). Loaded once when the modal opens.
  const [knownDistricts, setKnownDistricts] = useState([])
  const [boxTypeOptions, setBoxTypeOptions] = useState([])
  const boxTypeNames = useMemo(
    () => Object.fromEntries(boxTypeOptions.map(t => [t.id, t.name])),
    [boxTypeOptions]
  )

  useEffect(() => {
    if (!open) return
    setErrMsg(null)
    setSubmitting(false)
    districtsApi.getAll().then(d => setKnownDistricts(Array.isArray(d) ? d : [])).catch(() => setKnownDistricts([]))
    boxTypesApi.getAll().then(d => setBoxTypeOptions(Array.isArray(d) ? d : [])).catch(() => setBoxTypeOptions([]))
    if (isEdit) {
      setName(user.name || '')
      setUsername(user.username || '')
      setRole(user.role || 'collector')
      setActive(user.active !== false)
      setAssignments(Array.isArray(user.area_assignments) ? user.area_assignments : [])
      setExclusions (Array.isArray(user.area_exclusions)  ? user.area_exclusions  : [])
      setCanSelfReportTasks(!!user.permissions?.can_self_report_tasks)
      setPassword('')
      setChangePw(false)
    } else {
      setName(''); setUsername(''); setRole('collector')
      setActive(true)
      setAssignments([]); setExclusions([])
      setCanSelfReportTasks(false)
      setPassword('')
      setChangePw(true) // create mode always requires password
    }
  }, [open, isEdit, user])

  // For collectors, areas matter; for admin/cashroom they're irrelevant.
  const showAreas = role === 'collector'

  async function handleSave() {
    setErrMsg(null)
    if (!name.trim())     return setErrMsg('יש להזין שם')
    if (!username.trim()) return setErrMsg('יש להזין שם משתמש')
    if (changePw) {
      if (password.length < 6) return setErrMsg('סיסמה חייבת להיות באורך 6 תווים לפחות')
    }

    setSubmitting(true)
    try {
      // Task 50: permissions are only meaningful for collector role; for
      // other roles we always send `{}` so toggling role doesn't leave a
      // stale flag attached.
      const permissions = role === 'collector'
        ? { can_self_report_tasks: !!canSelfReportTasks }
        : {}

      let saved
      if (isEdit) {
        const patch = {
          name: name.trim(),
          username: username.trim(),
          role,
          active,
          area_assignments: assignments,
          area_exclusions:  exclusions,
          permissions,
        }
        if (changePw && password) patch.password = password
        // don't send a role-change for self (backend rejects it anyway)
        if (isSelf) {
          delete patch.role
          delete patch.active
        }
        saved = await usersApi.update(user.id, patch)
      } else {
        saved = await usersApi.create({
          name: name.trim(),
          username: username.trim(),
          password,
          role,
          area_assignments: assignments,
          area_exclusions:  exclusions,
          permissions,
        })
      }
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בשמירה')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate() {
    if (!isEdit || isSelf) return
    if (!window.confirm(`להפוך את "${user.name}" ללא פעיל?`)) return
    setSubmitting(true)
    setErrMsg(null)
    try {
      await usersApi.remove(user.id)
      onDeactivated?.(user.id)
      onClose?.()
    } catch (err) {
      setErrMsg(err.message || 'שגיאה בהפיכה ללא פעיל')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      wide
      title={isEdit ? `עריכת משתמש — ${user?.name || ''}` : 'משתמש חדש'}
      footer={
        <>
          {isEdit && !isSelf && active ? (
            <button
              className="btn sm"
              type="button"
              onClick={handleDeactivate}
              disabled={submitting}
              style={{ color: 'var(--red)' }}
            >הפיכה ללא פעיל</button>
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
      <div className="modal-row">
        <div className="field">
          <label>שם *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>שם משתמש *</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
      </div>

      <div className="modal-row">
        <div className="field">
          <label>תפקיד</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSelf}
            title={isSelf ? 'לא ניתן לשנות את התפקיד של עצמך' : undefined}
          >
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {isEdit && (
          <div className="field">
            <label>סטטוס</label>
            <select
              value={active ? '1' : '0'}
              onChange={(e) => setActive(e.target.value === '1')}
              disabled={isSelf}
              title={isSelf ? 'לא ניתן להשבית את עצמך' : undefined}
            >
              <option value="1">פעיל</option>
              <option value="0">לא פעיל</option>
            </select>
          </div>
        )}
      </div>

      {/* Password */}
      <div style={{ marginBottom: 14 }}>
        {isEdit && !changePw ? (
          <button
            type="button"
            className="btn sm"
            onClick={() => setChangePw(true)}
          >🔑 שנה סיסמה</button>
        ) : (
          <div className="field">
            <label>{isEdit ? 'סיסמה חדשה *' : 'סיסמה *'} (לפחות 6 תווים)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {isEdit && (
              <button
                type="button"
                className="btn sm"
                style={{ marginTop: 6 }}
                onClick={() => { setChangePw(false); setPassword('') }}
              >ביטול שינוי סיסמה</button>
            )}
          </div>
        )}
      </div>

      {role === 'collector' && (
        <div style={{
          background: 'var(--bg2, #f9fafb)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
            🔐 הרשאות מיוחדות
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={canSelfReportTasks}
              onChange={(e) => setCanSelfReportTasks(e.target.checked)}
            />
            יכול לדווח על משימות שביצע בעצמו
          </label>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, marginInlineStart: 24 }}>
            הגובה יוכל ליצור משימה (התקנה / החלפת מנעול וכו') ולסמן אותה כמבוצעת ללא מעורבות מנהל.
          </div>
        </div>
      )}

      {showAreas && (
        <>
          <RulesEditor
            label="שיוך אזורים (היררכי — מחוז ← עיר ← שכונה ← רחוב ← קופה, ניתן להוסיף סינון לפי סוג קופה)"
            rules={assignments}
            onChange={setAssignments}
            knownDistricts={knownDistricts}
            boxTypeOptions={boxTypeOptions}
            boxTypeNames={boxTypeNames}
          />
          <RulesEditor
            label="החרגות (אזורים שיוסרו מתוך השיוך)"
            rules={exclusions}
            onChange={setExclusions}
            knownDistricts={knownDistricts}
            boxTypeOptions={boxTypeOptions}
            boxTypeNames={boxTypeNames}
          />
        </>
      )}
      {!showAreas && (isEdit && (assignments.length > 0 || exclusions.length > 0)) && (
        <div className="alert info" style={{ marginBottom: 12 }}>
          ℹ️ שיוכי אזורים רלוונטיים רק לתפקיד "גובה". בשמירה, הם יישמרו אך לא ישפיעו.
        </div>
      )}

      {errMsg && <div className="alert red">{errMsg}</div>}
    </Modal>
  )
}
