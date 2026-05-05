import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cards as cardsApi } from '../api/endpoints'
import { daysSince } from '../utils/daysSince'
import { computeCardLabels } from '../utils/cardLabel'

export default function BoxesPage() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('days_desc')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    cardsApi.getAll({ status: 'active' })
      .then((rows) => {
        if (cancelled) return
        setList(Array.isArray(rows) ? rows : [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'שגיאה בטעינת הקופות')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200)
    return () => clearTimeout(t)
  }, [searchInput])

  const labels = useMemo(() => computeCardLabels(list), [list])

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
    }
    return arr
  }, [list, search, sort])

  if (loading) return <div className="loading">טוען...</div>
  if (error) return <div className="alert red">{error}</div>

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
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{list.length === 0 ? 'אין קופות משויכות' : 'לא נמצאו תוצאות'}</div>
      ) : (
        <div className="boxes-list">
          {filtered.map((c) => {
            const label = labels.get(c.id) || String(c.iron_number ?? '')
            const title = c.custom_name || label
            const days = daysSince(c.last_collection_at)
            const tagText = days == null ? 'טרם נגבה' : `${days} ימים`
            return (
              <div
                key={c.id}
                className="box-row"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/collection/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/collection/${c.id}`)
                  }
                }}
              >
                <div className="box-row-num">#{label}</div>
                <div className="box-row-main">
                  <div className="box-row-name">{title}</div>
                  <div className="box-row-city">{c.city || ''}</div>
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
