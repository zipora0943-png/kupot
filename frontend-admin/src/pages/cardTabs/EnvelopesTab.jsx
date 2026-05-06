import React, { useEffect, useState } from 'react'
import { envelopes as envelopesApi } from '../../api/endpoints'
import CreateEnvelopeModal from '../../components/CreateEnvelopeModal'
import CashroomModal from '../../components/CashroomModal'
import { exportCsv, csvFilename } from '../../utils/exportCsv'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('he-IL')
}

function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return '—'
  const num = Number(amount)
  if (Number.isNaN(num)) return amount
  return '₪' + num.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const STATUS = {
  pending: { label: 'ממתין', cls: 'yellow' },
  entered: { label: 'הוזן',  cls: 'green'  },
}

export default function EnvelopesTab({ cardId, boxId }) {
  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg]   = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [openEnv, setOpenEnv] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErrMsg(null)
    envelopesApi.getAll({ card_id: cardId })
      .then(d => { if (!cancelled) setList(Array.isArray(d) ? d : []) })
      .catch(err => { if (!cancelled) setErrMsg(err.message || 'שגיאה בטעינת מעטפות') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cardId])

  async function handleCreateEnvelope(envelopeNumber, notes) {
    try {
      const newEnvelope = await envelopesApi.create({
        box_id: boxId,
        envelope_number: envelopeNumber,
        notes: notes || null,
      })
      setList(prev => [newEnvelope, ...prev])
      setShowCreateModal(false)
    } catch (err) {
      throw err
    }
  }

  function handleEnvSaved(updated) {
    if (!updated) return
    setList(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
  }

  if (loading) return <div className="loading"><div className="spinner" /><span>טוען מעטפות...</span></div>
  if (errMsg)  return <div className="alert red">{errMsg}</div>

  const total = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const enteredCount = list.filter(e => e.status === 'entered').length

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          סה"כ: <strong style={{ color: 'var(--text)' }}>{formatAmount(total)}</strong>
          {' · '}{list.length} מעטפות ({enteredCount} הוזנו)
        </div>
        <div className="entity-actions">
          <button
            className="btn sm"
            disabled={list.length === 0}
            onClick={() => exportCsv(
              list,
              [
                { key: 'collected_at',     label: 'תאריך גביה', format: (v) => v ? new Date(v).toLocaleDateString('he-IL') : '' },
                { key: 'envelope_number',  label: 'מס\' מעטפה' },
                { key: 'amount',           label: 'סכום' },
                { key: 'collected_by_name', label: 'גובה' },
                { key: 'status',           label: 'סטטוס', format: (v) => STATUS[v]?.label || v || '' },
                { key: 'notes',            label: 'הערות' },
              ],
              csvFilename(`card_${cardId}_envelopes`)
            )}
          >📥 יצוא לאקסל</button>
          <button
            className="btn sm"
            onClick={() => setShowCreateModal(true)}
          >➕ צור מעטפה</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">אין מעטפות לכרטסת זו</div>
      ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>תאריך גביה</th>
              <th>מס' מעטפה</th>
              <th>סכום</th>
              <th>גובה</th>
              <th>סטטוס</th>
              <th>הערות</th>
              <th>פעולה</th>
            </tr>
          </thead>
          <tbody>
            {list.map(e => {
              const st = STATUS[e.status] || { label: e.status, cls: 'gray' }
              return (
                <tr key={e.id}>
                  <td>{formatDate(e.collected_at)}</td>
                  <td><strong>{e.envelope_number}</strong></td>
                  <td>{formatAmount(e.amount)}</td>
                  <td>{e.collected_by_name || '—'}</td>
                  <td><span className={'pill ' + st.cls}>{st.label}</span></td>
                  <td>{e.notes || '—'}</td>
                  <td className="actions">
                    <button
                      className="btn sm"
                      onClick={() => setOpenEnv(e)}
                    >{e.status === 'entered' ? '✏️ ערוך סכום' : 'פרטים'}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {showCreateModal && (
        <CreateEnvelopeModal
          onClose={() => setShowCreateModal(false)}
          onConfirm={handleCreateEnvelope}
        />
      )}

      <CashroomModal
        open={!!openEnv}
        envelope={openEnv}
        onClose={() => setOpenEnv(null)}
        onSaved={handleEnvSaved}
      />
    </>
  )
}
