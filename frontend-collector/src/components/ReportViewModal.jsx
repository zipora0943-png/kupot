import React from 'react'
import Modal from '@shared/components/Modal'
import { assetUrl } from '../utils/assetUrl'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_LABELS = {
  open: 'פתוח',
  converted: 'בטיפול',
  closed: 'סגור',
}

/**
 * Read-only report details, used by the maintenance (תחזוקה) role. Unlike the
 * admin ReportModal there is no status editing or convert-to-task — maintenance
 * only views reports across the country.
 *
 * Props:
 *   open    — boolean
 *   report  — the report row (or null)
 *   onClose — () => void
 */
export default function ReportViewModal({ open, report, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={report ? `דיווח #${report.id}` : 'דיווח'}
      footer={
        <>
          <div />
          <div className="actions">
            <button className="btn" type="button" onClick={onClose}>סגור</button>
          </div>
        </>
      }
    >
      {!report ? null : (
        <>
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
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>מדווח</div>
              <div>{report.reporter_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>תאריך</div>
              <div>{formatDate(report.created_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>מיקום</div>
              <div>{[report.city, report.neighborhood, report.street].filter(Boolean).join(', ') || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>סטטוס</div>
              <div>{STATUS_LABELS[report.status] || report.status || '—'}</div>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>תיאור</label>
            <div style={{
              whiteSpace: 'pre-wrap',
              padding: 10,
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 8,
              background: 'var(--bg2, #f9fafb)',
              minHeight: 50,
            }}>{report.description || '—'}</div>
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
        </>
      )}
    </Modal>
  )
}
