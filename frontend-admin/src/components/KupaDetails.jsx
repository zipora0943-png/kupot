import React from 'react'

/**
 * Read-only display of the kupa (קופה) details attached to a task.
 *
 * Reads the joined fields the /api/tasks endpoints return:
 *   iron_number, box_type_name,
 *   card_installation_type, card_city, card_neighborhood,
 *   card_street, card_building, card_location_notes
 *
 * The location / installation-type fields live on the kupa's card (כרטסת);
 * the backend resolves the relevant card (task's own → active → latest).
 * Renders nothing when there is no kupa data (e.g. a deferred installation
 * task whose box + card are created only at execution time).
 */
export default function KupaDetails({ task, style }) {
  if (!task) return null

  const ironLabel = task.iron_number
    ? `#${task.iron_number}`
    : (task.box_id ? `#${task.box_id}` : null)
  const streetBuilding = [task.card_street, task.card_building]
    .filter(Boolean)
    .join(' ') || null

  const rows = [
    ['מספר קופה',   ironLabel],
    ['סוג קופה',    task.box_type_name],
    ['סוג התקנה',   task.card_installation_type],
    ['עיר',         task.card_city],
    ['שכונה',       task.card_neighborhood],
    ['רחוב + בניין', streetBuilding],
    ['הערות מיקום', task.card_location_notes],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '')

  if (rows.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg2, #f9fafb)',
      border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
      ...style,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
        🏠 פרטי הקופה
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 13 }}>
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <div style={{ color: 'var(--text2)' }}>{k}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{v}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
