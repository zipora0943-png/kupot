// Export data to CSV file
export function exportToCsv(filename, rows, headers) {
  if (!rows || rows.length === 0) {
    alert('אין נתונים לייצוא')
    return
  }

  // CSV headers
  const csvHeaders = headers || Object.keys(rows[0])
  const headerLine = csvHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')

  // CSV rows
  const csvRows = rows.map(row =>
    csvHeaders
      .map(h => {
        let val = row[h]
        if (val === null || val === undefined) val = ''
        if (typeof val === 'string') val = val.replace(/"/g, '""')
        return `"${val}"`
      })
      .join(',')
  )

  // Combine and add BOM for Hebrew support in Excel
  const csv = '﻿' + [headerLine, ...csvRows].join('\n')

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Export cards to CSV.
// cityDistrictMap (optional) is Map<cityName, district> — adds a מחוז column.
export function exportCards(cards, filename = 'כרטסות', cityDistrictMap = null) {
  const rows = cards.map(c => ({
    'מספר קופה': c.iron_number || '',
    'קוד כרטסת': c.id,
    'שם': c.custom_name || '',
    'מחוז': cityDistrictMap ? (cityDistrictMap.get(c.city) || '') : '',
    'עיר': c.city || '',
    'שכונה': c.neighborhood || '',
    'רחוב': c.street || '',
    'בנין': c.building || '',
    'גובה': c.collector_name || '',
    'גביה אחרונה': c.last_collection_at ? new Date(c.last_collection_at).toLocaleDateString('he-IL') : '',
    'סטטוס': c.status === 'active' ? 'פעילה' : 'סגורה',
    'דיווח פתוח': c.has_open_report ? 'כן' : '',
    'משימה פתוחה': c.has_open_task ? 'כן' : '',
  }))

  exportToCsv(filename, rows, [
    'מספר קופה',
    'קוד כרטסת',
    'שם',
    'מחוז',
    'עיר',
    'שכונה',
    'רחוב',
    'בנין',
    'גובה',
    'גביה אחרונה',
    'סטטוס',
    'דיווח פתוח',
    'משימה פתוחה',
  ])
}

// Export envelopes to CSV
export function exportEnvelopes(envelopes, filename = 'מעטפות') {
  const rows = envelopes.map(e => ({
    'תאריך': e.collected_at ? new Date(e.collected_at).toLocaleDateString('he-IL') : '',
    'מספר מעטפה': e.envelope_number || '',
    'סכום': e.amount || '',
    'גובה': e.collector_name || '',
    'סטטוס': e.status === 'entered' ? 'הוזן' : 'ממתין',
    'הערות': e.notes || '',
  }))

  exportToCsv(filename, rows, [
    'תאריך',
    'מספר מעטפה',
    'סכום',
    'גובה',
    'סטטוס',
    'הערות',
  ])
}

// Export boxes to CSV — column set varies by which tab is active.
// ctx provides { labels, lastClosedByBox, activeCardByBox } from BoxesPage.
export function exportBoxes(boxes, tab, ctx, filename = 'קופות') {
  const { labels, lastClosedByBox, activeCardByBox } = ctx
  let headers = []
  let rows = []

  if (tab === 'active') {
    headers = ['מספר קופה', 'סוג', 'כרטסת פעילה', 'עיר', 'שכונה', 'רחוב', 'בנין']
    rows = boxes.map(b => {
      const active = activeCardByBox.get(b.id)
      return {
        'מספר קופה':    b.iron_number || '',
        'סוג':          b.box_type_name || '',
        'כרטסת פעילה': active ? (labels.get(active.id) || `#${active.id}`) : '',
        'עיר':          active?.city || '',
        'שכונה':        active?.neighborhood || '',
        'רחוב':         active?.street || '',
        'בנין':         active?.building || '',
      }
    })
  } else if (tab === 'unusable') {
    headers = ['מספר קופה', 'סוג', 'כרטסת אחרונה', 'הערות']
    rows = boxes.map(b => {
      const last = lastClosedByBox.get(b.id)
      return {
        'מספר קופה':     b.iron_number || '',
        'סוג':           b.box_type_name || '',
        'כרטסת אחרונה': last ? (labels.get(last.id) || `#${last.id}`) : '',
        'הערות':         b.notes || '',
      }
    })
  } else {
    // no_card (default) — uninstalled + inactive
    headers = ['מספר קופה', 'סוג', 'כרטסת אחרונה', 'תאריך סגירת כרטסת']
    rows = boxes.map(b => {
      const last = lastClosedByBox.get(b.id)
      return {
        'מספר קופה':          b.iron_number || '',
        'סוג':                b.box_type_name || '',
        'כרטסת אחרונה':      last ? (labels.get(last.id) || `#${last.id}`) : '',
        'תאריך סגירת כרטסת': last?.closed_at ? new Date(last.closed_at).toLocaleDateString('he-IL') : '',
      }
    })
  }

  exportToCsv(filename, rows, headers)
}

// Export reports to CSV
export function exportReports(reports, filename = 'דיווחים') {
  const rows = reports.map(r => ({
    'תאריך': r.created_at ? new Date(r.created_at).toLocaleDateString('he-IL') : '',
    'קופה': r.iron_number || '',
    'סוג': r.report_type_name || '',
    'תאור': r.description || '',
    'סטטוס': r.status || '',
    'מוקצה ל': r.assigned_to_name || '',
  }))

  exportToCsv(filename, rows, [
    'תאריך',
    'קופה',
    'סוג',
    'תאור',
    'סטטוס',
    'מוקצה ל',
  ])
}
