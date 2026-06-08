import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '@shared/context/DataStoreContext'
import { useAuth } from '@shared/context/AuthContext'
import { daysSince } from '../utils/daysSince'

const STORAGE_KEY = 'collector:boxes:filters'

function readStoredFilters() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object') ? parsed : null
  } catch {
    return null
  }
}

export default function BoxesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Maintenance (תחזוקה) opens a read-only box detail screen (no collection flow);
  // collectors go to the collection screen.
  const openBox = (cardId) =>
    navigate(user?.role === 'maintenance' ? `/box/${cardId}` : `/collection/${cardId}`)
  // Read from the central store — populated at login and kept fresh by
  // Socket.IO. Filter to active cards in-memory (the store holds all statuses).
  const { data: allCards, loading } = useData('cards')
  const list = useMemo(
    () => (Array.isArray(allCards) ? allCards.filter((c) => c.status === 'active') : []),
    [allCards],
  )

  const stored = useMemo(() => readStoredFilters(), [])
  const [searchInput, setSearchInput] = useState(stored?.search ?? '')
  const [search, setSearch] = useState(stored?.search ?? '')
  const [sort, setSort] = useState(stored?.sort ?? 'days_desc')

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ search: searchInput, sort }))
    } catch { /* ignore quota errors */ }
  }, [searchInput, sort])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200)
    return () => clearTimeout(t)
  }, [searchInput])

  const filtered = useMemo(() => {
    const base = !search
      ? list
      : list.filter((c) => {
          const haystack = [
            String(c.iron_number ?? ''),
            c.custom_name || '',
            c.city || '',
            c.neighborhood || '',
            c.street || '',
            c.building || '',
          ].join(' ').toLowerCase()
          return haystack.includes(search)
        })
    const arr = [...base]
    if (sort === 'days_desc') {
      arr.sort((a, b) => {
        const da = daysSince(a.last_collection_at)
        const db = daysSince(b.last_collection_at)
        const va = da == null ? Number.POSITIVE_INFINITY : da
        const vb = db == null ? Number.POSITIVE_INFINITY : db
        return vb - va
      })
    } else if (sort === 'iron_asc') {
      arr.sort((a, b) => Number(a.iron_number || 0) - Number(b.iron_number || 0))
    } else if (sort === 'name_asc') {
      arr.sort((a, b) => {
        const na = a.custom_name || `קופה ${a.iron_number}`
        const nb = b.custom_name || `קופה ${b.iron_number}`
        return na.localeCompare(nb, 'he')
      })
    } else if (sort === 'street_asc') {
      arr.sort((a, b) => (a.street || '').localeCompare(b.street || '', 'he'))
    }
    return arr
  }, [list, search, sort])

  if (loading) return <div className="loading">טוען...</div>

  return (
    <div>
      <div className="boxes-toolbar">
        <input
          type="search"
          placeholder="חיפוש קופה / שם / עיר / רחוב..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="days_desc">מיון: ימים ללא גביה (יורד)</option>
          <option value="iron_asc">מיון: מספר קופה (עולה)</option>
          <option value="name_asc">מיון: שם (א-ת)</option>
          <option value="street_asc">מיון: רחוב (א-ת)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{list.length === 0 ? 'אין קופות משויכות' : 'לא נמצאו תוצאות'}</div>
      ) : (
        <div className="boxes-list">
          {filtered.map((c) => {
            const days = daysSince(c.last_collection_at)
            const tagText = days == null ? 'טרם נגבה' : `${days} ימים`
            return (
              <div
                key={c.id}
                className="box-row"
                role="button"
                tabIndex={0}
                onClick={() => openBox(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openBox(c.id)
                  }
                }}
              >
                <div className="box-row-num">קופה: {c.iron_number ?? '—'}</div>
                <div className="box-row-main">
                  {c.custom_name && <div className="box-row-name">{c.custom_name}</div>}
                  <div className="box-row-city">
                    {[c.city, c.neighborhood, [c.street, c.building].filter(Boolean).join(' ')]
                      .filter((s) => typeof s === 'string' && s.trim())
                      .join(' • ')}
                  </div>
                </div>
                <div className="box-row-tag">{tagText}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
