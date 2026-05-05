import React, { useEffect, useState } from 'react'
import {
  settings as settingsApi,
  taskTypes as taskTypesApi,
  reportTypes as reportTypesApi,
  boxTypes as boxTypesApi,
} from '../api/endpoints'
import TaskTypeModal from '../components/TaskTypeModal'
import ReportTypeModal from '../components/ReportTypeModal'
import BoxTypeModal from '../components/BoxTypeModal'

const ITEM_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderBottom: '1px solid var(--border, #eef0f3)',
}

const LOGIC_TAG_BASE = {
  display: 'inline-block',
  padding: '2px 8px',
  marginInlineEnd: 4,
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
}

function LogicTag({ kind, children }) {
  const colors = {
    open:  { bg: 'var(--green-soft, #dcfce7)', color: 'var(--green, #16a34a)' },
    close: { bg: 'var(--red-soft, #fee2e2)',   color: 'var(--red, #dc2626)' },
    none:  { bg: 'var(--bg2, #f3f4f6)',        color: 'var(--text2, #6b7280)' },
  }
  const c = colors[kind] || colors.none
  return (
    <span style={{ ...LOGIC_TAG_BASE, background: c.bg, color: c.color }}>
      {children}
    </span>
  )
}

function describeTaskLogic(t) {
  if (t.opens_card && t.closes_card) {
    return [<LogicTag key="c" kind="close">סגירת כרטסת</LogicTag>,
            <LogicTag key="o" kind="open">פתיחת כרטסת</LogicTag>]
  }
  if (t.opens_card)  return [<LogicTag key="o" kind="open">פתיחת כרטסת</LogicTag>]
  if (t.closes_card) return [<LogicTag key="c" kind="close">סגירת כרטסת</LogicTag>]
  return [<LogicTag key="n" kind="none">ללא פעולת כרטסת</LogicTag>]
}

export default function SettingsPage() {
  // Global settings
  const [alertDays, setAlertDays] = useState('30')
  const [origAlertDays, setOrigAlertDays] = useState('30')
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [globalMsg, setGlobalMsg] = useState(null)

  // Type lists (null = loading, [] = empty)
  const [taskList, setTaskList] = useState(null)
  const [reportList, setReportList] = useState(null)
  const [boxList, setBoxList] = useState(null)

  // Modal state — { which, item } where item===null means create
  const [modal, setModal] = useState(null)
  function openModal(which, item = null) { setModal({ which, item }) }
  function closeModal() { setModal(null) }

  // Helpers to upsert / remove items inside a list
  function upsert(setter, saved) {
    setter(prev => {
      const list = Array.isArray(prev) ? prev : []
      const idx = list.findIndex(t => t.id === saved.id)
      if (idx >= 0) {
        const next = list.slice(); next[idx] = { ...list[idx], ...saved }
        return next
      }
      return [...list, saved]
    })
  }
  function removeById(setter, id) {
    setter(prev => (Array.isArray(prev) ? prev.filter(t => t.id !== id) : prev))
  }

  // Initial load
  useEffect(() => {
    let cancelled = false
    settingsApi.getAll().then(s => {
      if (cancelled) return
      const v = s?.alert_days_global ?? '30'
      setAlertDays(String(v))
      setOrigAlertDays(String(v))
    }).catch(() => {})

    taskTypesApi.getAll().then(d => !cancelled && setTaskList(Array.isArray(d) ? d : [])).catch(() => !cancelled && setTaskList([]))
    reportTypesApi.getAll().then(d => !cancelled && setReportList(Array.isArray(d) ? d : [])).catch(() => !cancelled && setReportList([]))
    boxTypesApi.getAll().then(d => !cancelled && setBoxList(Array.isArray(d) ? d : [])).catch(() => !cancelled && setBoxList([]))

    return () => { cancelled = true }
  }, [])

  async function saveGlobal() {
    setGlobalMsg(null)
    const n = Number.parseInt(alertDays, 10)
    if (!Number.isInteger(n) || n < 1 || n > 3650) {
      setGlobalMsg({ type: 'red', text: 'יש להזין מספר שלם בין 1 ל-3650' })
      return
    }
    setSavingGlobal(true)
    try {
      const res = await settingsApi.update('alert_days_global', n)
      const v = String(res?.alert_days_global ?? n)
      setAlertDays(v)
      setOrigAlertDays(v)
      setGlobalMsg({ type: 'green', text: 'נשמר בהצלחה' })
      setTimeout(() => setGlobalMsg(null), 3000)
    } catch (err) {
      setGlobalMsg({ type: 'red', text: err.message || 'שגיאה בשמירה' })
    } finally {
      setSavingGlobal(false)
    }
  }

  const isDirty = String(alertDays) !== String(origAlertDays)

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">הגדרות</div>
          <div className="page-subtitle">סוגים ופרמטרים גלובליים של המערכת</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>

        {/* === TASK TYPES === */}
        <div className="panel">
          <div className="panel-title">סוגי משימות</div>
          {taskList === null ? (
            <div className="loading"><div className="spinner" /><span>טוען...</span></div>
          ) : taskList.length === 0 ? (
            <div className="empty">אין סוגי משימות להצגה</div>
          ) : (
            taskList.map(t => (
              <div key={t.id} style={ITEM_ROW_STYLE}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {t.icon ? `${t.icon} ` : ''}{t.name}
                  </div>
                  <div style={{ marginTop: 4 }}>{describeTaskLogic(t)}</div>
                </div>
                <button
                  className="btn sm"
                  onClick={() => openModal('task', t)}
                >עריכה</button>
              </div>
            ))
          )}
          <button
            className="btn sm"
            style={{ marginTop: 12 }}
            onClick={() => openModal('task')}
          >+ הוספת סוג משימה</button>
        </div>

        {/* === REPORT TYPES === */}
        <div className="panel">
          <div className="panel-title">סוגי דיווחים</div>
          {reportList === null ? (
            <div className="loading"><div className="spinner" /><span>טוען...</span></div>
          ) : reportList.length === 0 ? (
            <div className="empty">אין סוגי דיווחים להצגה</div>
          ) : (
            reportList.map(t => (
              <div key={t.id} style={ITEM_ROW_STYLE}>
                <div style={{ fontWeight: 600 }}>
                  {t.icon ? `${t.icon} ` : ''}{t.name}
                </div>
                <button
                  className="btn sm"
                  onClick={() => openModal('report', t)}
                >עריכה</button>
              </div>
            ))
          )}
          <button
            className="btn sm"
            style={{ marginTop: 12 }}
            onClick={() => openModal('report')}
          >+ הוספת סוג דיווח</button>
        </div>

        {/* === BOX TYPES === */}
        <div className="panel">
          <div className="panel-title">סוגי קופות</div>
          {boxList === null ? (
            <div className="loading"><div className="spinner" /><span>טוען...</span></div>
          ) : boxList.length === 0 ? (
            <div className="empty">אין סוגי קופות להצגה</div>
          ) : (
            boxList.map(t => (
              <div key={t.id} style={ITEM_ROW_STYLE}>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <button
                  className="btn sm"
                  onClick={() => openModal('box', t)}
                >עריכה</button>
              </div>
            ))
          )}
          <button
            className="btn sm"
            style={{ marginTop: 12 }}
            onClick={() => openModal('box')}
          >+ הוספה</button>
        </div>

        {/* === GLOBAL SETTINGS === */}
        <div className="panel">
          <div className="panel-title">הגדרות כלליות</div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>ימים ללא גביה להתראה (גלובלי)</label>
            <input
              type="number"
              min="1"
              max="3650"
              value={alertDays}
              onChange={(e) => setAlertDays(e.target.value)}
              style={{ width: 120 }}
            />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              ערך זה משמש כברירת מחדל. ניתן להגדיר סף אישי ברמת כרטסת.
            </div>
          </div>

          {globalMsg && (
            <div className={'alert ' + globalMsg.type} style={{ marginBottom: 12 }}>
              {globalMsg.text}
            </div>
          )}

          <button
            className="btn primary sm"
            onClick={saveGlobal}
            disabled={savingGlobal || !isDirty}
          >
            {savingGlobal ? 'שומר...' : 'שמירה'}
          </button>
          {isDirty && !savingGlobal && (
            <button
              className="btn sm"
              style={{ marginInlineStart: 8 }}
              onClick={() => { setAlertDays(origAlertDays); setGlobalMsg(null) }}
            >ביטול</button>
          )}
        </div>

      </div>

      <TaskTypeModal
        open={modal?.which === 'task'}
        item={modal?.which === 'task' ? modal.item : null}
        onClose={closeModal}
        onSaved={(saved) => upsert(setTaskList, saved)}
        onDeleted={(id) => removeById(setTaskList, id)}
      />

      <ReportTypeModal
        open={modal?.which === 'report'}
        item={modal?.which === 'report' ? modal.item : null}
        onClose={closeModal}
        onSaved={(saved) => upsert(setReportList, saved)}
        onDeleted={(id) => removeById(setReportList, id)}
      />

      <BoxTypeModal
        open={modal?.which === 'box'}
        item={modal?.which === 'box' ? modal.item : null}
        onClose={closeModal}
        onSaved={(saved) => upsert(setBoxList, saved)}
        onDeleted={(id) => removeById(setBoxList, id)}
      />
    </div>
  )
}
