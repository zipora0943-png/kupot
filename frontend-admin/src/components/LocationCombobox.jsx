import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cards as cardsApi } from '../api/endpoints'

/**
 * Free-input combobox for entering a city / neighborhood / street that suggests
 * values already present in other cards — to discourage spelling/grammar variants
 * of the same physical place from accumulating in the data.
 *
 * The user can always type a brand-new value (the suggestions are advisory).
 *
 * Props:
 *   level         — 'city' | 'neighborhood' | 'street'   (required)
 *   value         — string                                (controlled)
 *   onChange      — (string) => void                     (called on every keystroke + on pick)
 *   city          — string  (required when level='neighborhood' | 'street')
 *   neighborhood  — string  (optional, used when level='street' to narrow further)
 *   disabled      — boolean
 *   placeholder   — string  (default per level)
 *   id            — optional input id (for label `htmlFor`)
 *   maxResults    — number  (default 50)
 */
export default function LocationCombobox({
  level,
  value,
  onChange,
  city,
  neighborhood,
  disabled,
  placeholder,
  id,
  maxResults = 50,
}) {
  const [options, setOptions] = useState([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const wrapRef = useRef(null)

  // The endpoint requires `city` for non-city levels — skip the fetch until it's set,
  // so we don't waste a 400 on every keystroke before the user picks a city.
  const canFetch =
    level === 'city' ||
    (level === 'neighborhood' && typeof city === 'string' && city.trim() !== '') ||
    (level === 'street'       && typeof city === 'string' && city.trim() !== '')

  // (Re)fetch the candidate pool whenever the parent context changes.
  useEffect(() => {
    if (!canFetch) {
      setOptions([])
      return
    }
    let cancelled = false
    const params = { level }
    if (level !== 'city') params.city = city
    if (level === 'street' && typeof neighborhood === 'string' && neighborhood.trim()) {
      params.neighborhood = neighborhood
    }
    cardsApi.locations(params)
      .then(list => {
        if (cancelled) return
        setOptions(Array.isArray(list) ? list : [])
      })
      .catch(() => { if (!cancelled) setOptions([]) })
    return () => { cancelled = true }
  }, [level, city, neighborhood, canFetch])

  // Close dropdown on outside click
  useEffect(() => {
    function onDocDown(e) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  const matches = useMemo(() => {
    const t = (value || '').trim()
    // When the field is empty, show the whole pool (capped) so the user can browse.
    // When typing, narrow by substring (case-insensitive).
    const pool = options
    if (!t) return pool.slice(0, maxResults)
    const lo = t.toLowerCase()
    return pool.filter(s => s.toLowerCase().includes(lo)).slice(0, maxResults)
  }, [options, value, maxResults])

  function selectOption(s) {
    onChange?.(s)
    setOpen(false)
  }

  function onInput(e) {
    onChange?.(e.target.value)
    setOpen(true)
    setHighlight(-1)
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && matches[highlight]) {
        e.preventDefault()
        selectOption(matches[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const ph = placeholder ?? (
    level === 'city' ? 'עיר'
    : level === 'neighborhood' ? 'שכונה'
    : 'רחוב'
  )

  // Show the dropdown only when there's something to show. An empty pool is fine
  // (just no suggestions) — the user can keep typing a brand-new value.
  const showList = open && matches.length > 0
  // Inform the user when the pool is non-empty but the typed text matches nothing,
  // so they understand they're entering a value that's not in the system yet.
  const showNoMatches =
    open && options.length > 0 && (value || '').trim() !== '' && matches.length === 0

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        id={id}
        type="text"
        value={value || ''}
        onChange={onInput}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={ph}
        autoComplete="off"
      />
      {showList && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%', insetInlineStart: 0, insetInlineEnd: 0,
            zIndex: 10,
            margin: '2px 0 0', padding: 0, listStyle: 'none',
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 6,
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
            maxHeight: 240, overflow: 'auto',
          }}
        >
          {matches.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => { e.preventDefault(); selectOption(s) }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                background: i === highlight ? 'var(--bg2, #f3f4f6)' : 'transparent',
                fontSize: 14,
              }}
            >{s}</li>
          ))}
        </ul>
      )}
      {showNoMatches && (
        <div
          style={{
            position: 'absolute',
            top: '100%', insetInlineStart: 0, insetInlineEnd: 0,
            zIndex: 10,
            marginTop: 2,
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 6,
            padding: '8px 10px',
            color: 'var(--text3)',
            fontSize: 13,
          }}
        >ערך חדש — לא קיים במערכת</div>
      )}
    </div>
  )
}
