import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Free-input autocomplete for selecting a box (קופה) by its iron_number.
 * Replaces a regular <select> dropdown so the user can type digits and see
 * matching options as they type.
 *
 * Props:
 *   boxes       — Array<{ id, iron_number, box_type_name? }>
 *   value       — currently selected box id ('' / number / string). Empty when none.
 *   onChange    — (boxId|'' ) => void; called when a suggestion is picked or selection cleared.
 *   disabled    — boolean
 *   placeholder — string (default: 'הקש מספר קופה...')
 *   autoFocus   — boolean
 *   maxResults  — number (default 10)
 *   id          — optional id passed to the input (for label `htmlFor`)
 */
export default function BoxNumberAutocomplete({
  boxes,
  value,
  onChange,
  disabled,
  placeholder = 'הקש מספר קופה...',
  autoFocus,
  maxResults = 10,
  id,
}) {
  const list = Array.isArray(boxes) ? boxes : []

  // Text shown in the input. Mirrors the picked box's iron_number when one is selected.
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  // Sync displayed text whenever the controlled value or boxes list changes
  // (e.g. on form reset, or when the parent prefills `value` before boxes load).
  useEffect(() => {
    if (value === '' || value == null) {
      setText('')
      return
    }
    const found = list.find(b => String(b.id) === String(value))
    if (found) setText(found.iron_number || `#${found.id}`)
  }, [value, list])

  // Close dropdown when the user clicks outside the wrapper
  useEffect(() => {
    function onDocDown(e) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  const matches = useMemo(() => {
    const t = text.trim()
    if (!t) return []
    return list
      .filter(b => String(b.iron_number || '').includes(t))
      .slice(0, maxResults)
  }, [list, text, maxResults])

  function selectBox(b) {
    setText(b.iron_number || `#${b.id}`)
    setOpen(false)
    onChange?.(b.id)
  }

  function onInput(e) {
    // Iron numbers are digits in this system — restrict input to digits only.
    const cleaned = String(e.target.value || '').replace(/\D+/g, '')
    setText(cleaned)
    setOpen(true)
    setHighlight(0)
    // Clear current selection while the user edits — parent decides what to do
    // when value is empty (e.g. block submit).
    if (value !== '' && value != null) onChange?.('')
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
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (matches[highlight]) {
        e.preventDefault()
        selectBox(matches[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showNoMatches = open && text.trim() && matches.length === 0

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        onChange={onInput}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%', insetInlineStart: 0, insetInlineEnd: 0,
            zIndex: 10,
            margin: '2px 0 0', padding: 0, listStyle: 'none',
            background: 'var(--card, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 6,
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
            maxHeight: 240, overflow: 'auto',
          }}
        >
          {matches.map((b, i) => (
            <li
              key={b.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => { e.preventDefault(); selectBox(b) }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                background: i === highlight ? 'var(--bg2, #f3f4f6)' : 'transparent',
                fontSize: 14,
              }}
            >
              <strong>{b.iron_number || `#${b.id}`}</strong>
              {b.box_type_name ? (
                <span style={{ color: 'var(--text3)', marginInlineStart: 8 }}>
                  · {b.box_type_name}
                </span>
              ) : null}
            </li>
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
            background: 'var(--card, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 6,
            padding: '8px 10px',
            color: 'var(--text3)',
            fontSize: 13,
          }}
        >
          לא נמצאו קופות תואמות
        </div>
      )}
    </div>
  )
}
