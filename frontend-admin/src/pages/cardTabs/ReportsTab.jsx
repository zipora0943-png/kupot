import React, { useEffect, useState } from 'react'
import { reports as reportsApi } from '../../api/endpoints'
import { useAuth } from '@shared/context/AuthContext'
import ManualReportModal from '../../components/ManualReportModal'
import CloseReportModal from '@shared/components/CloseReportModal'
import ReportModal from '../../components/ReportModal'
import { exportCsv, csvFilename } from '../../utils/exportCsv'
import PaginatedTable from '../../utils/PaginatedTable.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('he-IL')
}

const STATUS = {
  open:      { label: 'פתוח',  cls: 'yellow' },
  converted: { label: 'הומר למשימה', cls: 'blue' },
  closed:    { label: 'סגור',  cls: 'gray'   },
}

export default function ReportsTab({ cardId, cardLabel }) {
  const { user } = useAuth()
  const canCreate = user?.role === 'admin'
  const canCreateReport = user?.role === 'admin' || user?.role === 'collector'

  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg]   = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [openReport,  setOpenReport]  = useState(null)
  const [closeReport, setCloseReport] = useState(null)
  const [reloadCounter, setReloadCounter] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErrMsg(null)
    reportsApi.getAll({ card_id: cardId })
      .then(d => { if (!cancelled) setList(Array.isArray(d) ? d : []) })
      .catch(err => { if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת דיווחים') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cardId, reloadCounter])

  function handleCreated() {
    setReloadCounter(c => c + 1)
  }

  function handleReportSaved(updated) {
    if (!updated) return
    setList(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
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
              { key: 'created_at',    label: 'תאריך', format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
              { key: 'type_name',     label: 'סוג' },
              { key: 'description',   label: 'תיאור' },
              { key: 'reporter_name', label: 'מדווח' },
              { key: 'status',        label: 'סטטוס', format: (v) => STATUS[v]?.label || v || '' },
              { key: 'closure_reason', label: 'סיבת סגירה' },
            ],
            csvFilename(`card_${cardId}_reports`)
          )}
        >📥 יצוא לאקסל</button>
        {canCreateReport && (
          <button className="btn sm" onClick={() => setShowModal(true)}>
            ➕ צור דיווח
          </button>
        )}
      </div>

      {loading && <div className="loading"><div className="spinner" /><span>טוען דיווחים...</span></div>}
      {!loading && errMsg && <div className="alert red">{errMsg}</div>}
      {!loading && !errMsg && list.length === 0 && <div className="empty">אין דיווחים לכרטסת זו</div>}
      {!loading && !errMsg && list.length > 0 && (
        <PaginatedTable
          data={list}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setOpenReport(r)}
          header={(
            <tr>
              <th>תאריך</th>
              <th>סוג</th>
              <th>תיאור</th>
              <th>מדווח</th>
              <th>סטטוס</th>
              {canCreate && <th>פעולות</th>}
            </tr>
          )}
          renderRow={(r) => {
            const st = STATUS[r.status] || { label: r.status, cls: 'gray' }
            return (
              <>
                <td>{formatDate(r.created_at)}</td>
                <td>{r.icon ? `${r.icon} ` : ''}{r.type_name || '—'}</td>
                <td style={{ maxWidth: 320 }}>{r.description || '—'}</td>
                <td>{r.reporter_name || '—'}</td>
                <td>
                  <span
                    className={'pill ' + st.cls}
                    title={r.status === 'closed' && r.closure_reason ? `סיבת סגירה: ${r.closure_reason}` : undefined}
                  >{st.label}</span>
                </td>
                {canCreate && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.status === 'open' && (
                      <button
                        className="btn sm danger"
                        onClick={(e) => { e.stopPropagation(); setCloseReport(r) }}
                      >🚫 סגור דיווח</button>
                    )}
                  </td>
                )}
              </>
            )
          }}
        />
      )}

      {showModal && (
        <ManualReportModal
          cardId={cardId}
          cardLabel={cardLabel || `#${cardId}`}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      <ReportModal
        open={!!openReport}
        report={openReport}
        onClose={() => setOpenReport(null)}
        onSaved={handleReportSaved}
      />

      {closeReport && (
        <CloseReportModal
          report={closeReport}
          onClose={() => setCloseReport(null)}
          onClosed={(updated) => {
            handleReportSaved(updated)
            setReloadCounter(c => c + 1)
          }}
        />
      )}
    </>
  )
}
