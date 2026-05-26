import React, { useEffect, useState } from 'react'
import { events as eventsApi } from '../../api/endpoints'
import { useAuth } from '@shared/context/AuthContext'
import ManualEventModal from '../../components/ManualEventModal'
import { exportCsv, csvFilename } from '../../utils/exportCsv'
import PaginatedTable from '../../utils/PaginatedTable.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('he-IL')
}

// Map backend event_type → Hebrew label + pill color
const EVENT_TYPE = {
  installation:    { label: 'התקנה',          cls: 'green'  },
  removal:         { label: 'הסרה',           cls: 'red'    },
  card_closed:     { label: 'סגירת כרטסת',    cls: 'gray'   },
  transfer_open:   { label: 'העברה (פתיחה)',  cls: 'purple' },
  transfer_close:  { label: 'העברה (סגירה)',  cls: 'purple' },
  collection:      { label: 'גביה',           cls: 'blue'   },
  task_done:       { label: 'ביצוע משימה',    cls: 'green'  },
  task_cancelled:  { label: 'ביטול משימה',    cls: 'red'    },
  mark_unusable:   { label: 'סומנה כלא שמישה', cls: 'red'   },
  reopen:          { label: 'פתיחה מחדש',     cls: 'green'  },
  amount_changed:  { label: 'שינוי סכום',     cls: 'yellow' },
  report_closed:   { label: 'סגירת דיווח',    cls: 'gray'   },
  other:           { label: 'אחר',            cls: 'gray'   },
}

export default function EventsTab({ cardId, cardLabel }) {
  const { user } = useAuth()
  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg]   = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [reloadCounter, setReloadCounter] = useState(0)

  const canCreate = user?.role === 'admin'
  const isCollector = user?.role === 'collector'

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErrMsg(null)
    eventsApi.getByCard(cardId)
      .then(d => {
        if (cancelled) return
        const items = Array.isArray(d) ? d : []
        // Task 35: collectors see only events tied to themselves.
        const visible = isCollector
          ? items.filter(e => Number(e.user_id) === Number(user?.id))
          : items
        setList(visible)
      })
      .catch(err => { if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת אירועים') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cardId, reloadCounter, isCollector, user?.id])

  function handleCreated() {
    setReloadCounter(c => c + 1)
  }

  return (
    <>
      <div className="entity-actions" style={{ marginBottom: 12 }}>
        <button
          className="btn sm"
          disabled={list.length === 0}
          onClick={() => exportCsv(
            list,
            [
              { key: 'created_at',  label: 'תאריך', format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
              { key: 'event_type',  label: 'סוג', format: (v) => EVENT_TYPE[v]?.label || v || '' },
              { key: 'description', label: 'תיאור' },
              { key: 'user_name',   label: 'משתמש' },
            ],
            csvFilename(`card_${cardId}_events`)
          )}
        >📥 יצוא לאקסל</button>
        {canCreate && (
          <button className="btn sm" onClick={() => setShowModal(true)}>
            ➕ צור אירוע
          </button>
        )}
      </div>

      {loading && <div className="loading"><div className="spinner" /><span>טוען אירועים...</span></div>}
      {!loading && errMsg && <div className="alert red">{errMsg}</div>}
      {!loading && !errMsg && list.length === 0 && <div className="empty">אין אירועים לכרטסת זו</div>}
      {!loading && !errMsg && list.length > 0 && (
        <PaginatedTable
          data={list}
          getRowKey={(e) => e.id}
          header={(
            <tr>
              <th>תאריך</th>
              <th>סוג</th>
              <th>תיאור</th>
              <th>משתמש</th>
            </tr>
          )}
          renderRow={(e) => {
            const t = EVENT_TYPE[e.event_type] || { label: e.event_type, cls: 'gray' }
            return (
              <>
                <td>{formatDate(e.created_at)}</td>
                <td><span className={'pill ' + t.cls}>{t.label}</span></td>
                <td>{e.description || '—'}</td>
                <td>{e.user_name || '—'}</td>
              </>
            )
          }}
        />
      )}

      {showModal && (
        <ManualEventModal
          cardId={cardId}
          cardLabel={cardLabel || `#${cardId}`}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
