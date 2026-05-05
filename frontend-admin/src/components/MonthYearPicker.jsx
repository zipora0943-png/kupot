import React from 'react'

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

// value: "YYYY-MM" (same shape as native <input type="month">)
// onChange(nextValue: "YYYY-MM")
export default function MonthYearPicker({ value, onChange, yearRange, style, selectStyle }) {
  const today = new Date()
  const curYear = today.getFullYear()
  const [yFrom, yTo] = yearRange || [curYear - 10, curYear + 1]

  const [yStr, mStr] = String(value || '').split('-')
  const year = Number(yStr) || curYear
  const month = Number(mStr) || (today.getMonth() + 1)

  function emit(y, m) {
    onChange(`${y}-${String(m).padStart(2, '0')}`)
  }

  const years = []
  for (let y = yTo; y >= yFrom; y--) years.push(y)

  return (
    <div style={{ display: 'flex', gap: 6, ...(style || {}) }}>
      <select
        value={month}
        onChange={(e) => emit(year, Number(e.target.value))}
        style={{ flex: 1, minWidth: 0, ...(selectStyle || {}) }}
      >
        {HEBREW_MONTHS.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => emit(Number(e.target.value), month)}
        style={{ flex: 1, minWidth: 0, ...(selectStyle || {}) }}
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}
