import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  groupCitiesByDistrict,
  selectionLabel,
  NO_DISTRICT,
  NO_DISTRICT_LABEL,
  ALL_SELECTION,
} from '../utils/districts'

/**
 * Single-select city filter, grouped by district.
 *
 * Districts appear as bold, clickable header rows (click = filter the whole
 * district), with their cities listed indented underneath in order. Cities
 * with no district fall under "ללא מחוז" at the end.
 *
 * Props:
 *   cities          — string[] of city names actually present (e.g. distinct from cards)
 *   cityDistrictMap — Map<cityName, district|null> (from buildCityDistrictMap)
 *   value           — selection object: { type: 'all' | 'district' | 'city', value? }
 *   onChange        — (selection) => void
 *   minWidth        — button min width (default 180)
 *   fontSize        — control font size (default 14)
 */
export default function DistrictCityPicker({
  cities,
  cityDistrictMap,
  value,
  onChange,
  minWidth = 180,
  fontSize = 14,
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const groups = useMemo(
    () => groupCitiesByDistrict(cities, cityDistrictMap),
    [cities, cityDistrictMap],
  )

  const sel = value || ALL_SELECTION

  function pick(next) {
    onChange?.(next)
    setOpen(false)
  }

  const rowBase = {
    padding: '6px 8px',
    cursor: 'pointer',
    borderRadius: 4,
    fontSize,
  }
  const hover = (e, on) => { e.currentTarget.style.background = on ? 'var(--bg)' : 'transparent' }

  function isSelected(type, val) {
    return sel.type === type && (type === 'all' || sel.value === val)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize,
          cursor: 'pointer',
          minWidth,
          textAlign: 'right',
        }}
      >{selectionLabel(sel)} ▾</button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          zIndex: 30,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: 6,
          minWidth: 240,
          maxHeight: 360,
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>
          <div
            style={{ ...rowBase, fontWeight: isSelected('all') ? 700 : 400,
                     color: isSelected('all') ? 'var(--accent)' : 'var(--text)' }}
            onClick={() => pick(ALL_SELECTION)}
            onMouseEnter={(e) => hover(e, true)}
            onMouseLeave={(e) => hover(e, false)}
          >כל הערים</div>

          {groups.length === 0 && (
            <div style={{ padding: 8, color: 'var(--text3)', fontSize: 13 }}>אין ערים</div>
          )}

          {groups.map(g => {
            const dLabel = g.district === NO_DISTRICT ? NO_DISTRICT_LABEL : g.district
            const dSelected = isSelected('district', g.district)
            return (
              <div key={g.district} style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
                <div
                  style={{
                    ...rowBase,
                    fontWeight: 700,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: dSelected ? 'var(--accent)' : 'var(--text)',
                    background: dSelected ? 'var(--bg)' : 'transparent',
                  }}
                  onClick={() => pick({ type: 'district', value: g.district })}
                  onMouseEnter={(e) => hover(e, true)}
                  onMouseLeave={(e) => e.currentTarget.style.background = dSelected ? 'var(--bg)' : 'transparent'}
                  title="סינון כל המחוז"
                >
                  <span>{dLabel}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>כל המחוז</span>
                </div>
                {g.cities.map(c => {
                  const cSelected = isSelected('city', c)
                  return (
                    <div
                      key={c}
                      style={{
                        ...rowBase,
                        paddingInlineStart: 20,
                        color: cSelected ? 'var(--accent)' : 'var(--text)',
                        fontWeight: cSelected ? 600 : 400,
                        background: cSelected ? 'var(--bg)' : 'transparent',
                      }}
                      onClick={() => pick({ type: 'city', value: c })}
                      onMouseEnter={(e) => hover(e, true)}
                      onMouseLeave={(e) => e.currentTarget.style.background = cSelected ? 'var(--bg)' : 'transparent'}
                    >{c}</div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
