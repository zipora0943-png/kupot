import React, { useMemo, useState } from 'react'

// useSortable: drives clickable column-header sorting for a table.
//
//   const accessors = useMemo(() => ({
//     iron_number:  (r) => r.iron_number,
//     city:         (r) => r.city,
//     last_collect: (r) => r.last_collection_at ? new Date(r.last_collection_at) : null,
//   }), [/* dep on any external map used inside accessor */])
//   const { sorted, sort, toggle } = useSortable(rows, accessors)
//
//   <SortableTh sortKey="iron_number" sort={sort} onToggle={toggle}>קופה</SortableTh>
//
// Click cycles asc → desc → unsorted (back to source order).
export function useSortable(rows, columnAccessors, initialSort = null) {
  const [sort, setSort] = useState(initialSort)

  const sorted = useMemo(() => {
    if (!sort?.key) return rows
    const accessor = columnAccessors[sort.key]
    if (typeof accessor !== 'function') return rows
    const dir = sort.dir === 'desc' ? -1 : 1
    return [...rows].sort((a, b) => compareVals(accessor(a), accessor(b)) * dir)
  }, [rows, sort, columnAccessors])

  function toggle(key) {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc')        return { key, dir: 'desc' }
      return null
    })
  }

  return { sorted, sort, toggle }
}

function compareVals(a, b) {
  const aEmpty = a == null || a === ''
  const bEmpty = b == null || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1   // empties always go to the end, regardless of dir
  if (bEmpty) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b), 'he', { numeric: true, sensitivity: 'base' })
}

export function SortableTh({ sortKey, sort, onToggle, children, style, title, ...rest }) {
  const isActive = sort?.key === sortKey
  const arrow = !isActive ? '↕' : (sort.dir === 'asc' ? '▲' : '▼')
  return (
    <th
      onClick={() => onToggle(sortKey)}
      style={{ cursor: 'pointer', userSelect: 'none', ...style }}
      title={title || 'לחץ למיון'}
      {...rest}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <span style={{
          fontSize: 10,
          color: isActive ? 'var(--accent)' : 'var(--text3)',
          fontWeight: isActive ? 700 : 400,
          opacity: isActive ? 1 : 0.65,
        }}>{arrow}</span>
      </span>
    </th>
  )
}
