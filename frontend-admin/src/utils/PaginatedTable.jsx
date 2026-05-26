import React, { useEffect, useState } from 'react'

// Page-size choices for the dropdown. `ALL` is a sentinel string; selecting it
// renders every row in `data` in a single page.
const PAGE_SIZES = [50, 100, 200, 500]
const DEFAULT_PAGE_SIZE = 200
const ALL = 'all'

// Plain (non-virtualized) table with pagination. Replaces the earlier
// scrolling-virtualization approach: rows are sliced to one page at a time
// so the DOM stays small without an infinite-scroll feel.
//
// The full filtered `data` array still lives in JS memory — search/sort/filter
// run upstream on the full set, then the resulting array is paginated here.
//
//   <PaginatedTable
//     data={sortedRows}
//     header={<tr><SortableTh .../></tr>}
//     footer={<tr className="summary-row"><td colSpan={N}>...</td></tr>}  // optional
//     renderRow={(item) => <><td>...</td></>}                              // returns <td>s
//     onRowClick={(item) => navigate(`/things/${item.id}`)}                // optional
//     getRowKey={(item) => item.id}                                        // optional
//   />
export default function PaginatedTable({
  data,
  header,
  footer,
  renderRow,
  onRowClick,
  getRowKey,
}) {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const total = data.length
  const effectiveSize = pageSize === ALL ? Math.max(total, 1) : pageSize
  const pageCount = Math.max(1, Math.ceil(total / effectiveSize))

  // When the upstream filter shrinks the result set below the current page,
  // jump back to page 0 so the user isn't stranded on an empty page.
  useEffect(() => {
    if (page > 0 && page >= pageCount) setPage(0)
  }, [page, pageCount])

  const start = page * effectiveSize
  const end = Math.min(start + effectiveSize, total)
  const visibleRows = data.slice(start, end)

  function handlePageSizeChange(value) {
    setPage(0)
    setPageSize(value === ALL ? ALL : Number(value))
  }

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>{header}</thead>
          <tbody>
            {visibleRows.map((item, i) => {
              const key = getRowKey ? getRowKey(item) : (start + i)
              return (
                <tr
                  key={key}
                  className={onRowClick ? 'clickable' : undefined}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {renderRow(item)}
                </tr>
              )
            })}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {total > 0 && (
        <PaginationBar
          total={total}
          start={start}
          end={end}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}

function PaginationBar({
  total, start, end, page, pageCount, pageSize, onPageChange, onPageSizeChange,
}) {
  return (
    <div className="pagination-bar">
      <span style={{ color: 'var(--text2)' }}>שורות בעמוד:</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(e.target.value)}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 13,
        }}
      >
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        <option value={ALL}>הכל</option>
      </select>

      <span style={{ color: 'var(--text2)' }}>
        מציג <strong style={{ color: 'var(--text)' }}>{start + 1}–{end}</strong>
        {' '}מתוך <strong style={{ color: 'var(--text)' }}>{total}</strong>
      </span>

      <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          className="btn sm"
          onClick={() => onPageChange(0)}
          disabled={page === 0}
          title="לעמוד הראשון"
        >«</button>
        <button
          className="btn sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          title="לעמוד הקודם"
        >‹</button>
        <span style={{ padding: '0 8px', color: 'var(--text2)' }}>
          עמוד <strong style={{ color: 'var(--text)' }}>{page + 1}</strong>
          {' '}מתוך <strong style={{ color: 'var(--text)' }}>{pageCount}</strong>
        </span>
        <button
          className="btn sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount - 1}
          title="לעמוד הבא"
        >›</button>
        <button
          className="btn sm"
          onClick={() => onPageChange(pageCount - 1)}
          disabled={page >= pageCount - 1}
          title="לעמוד האחרון"
        >»</button>
      </div>
    </div>
  )
}
