// City → district helpers for filters and exports.
//
// Districts are free-text values on the `cities` settings table (cities.district).
// The bootstrap (/api/initial-load) ships `cities: [{ name, district }]`, so the
// whole city↔district mapping is available client-side with no extra round-trip.
//
// A "selection" used by DistrictCityPicker is one of:
//   { type: 'all' }                     — no city/district filter
//   { type: 'district', value: <name> } — every city in that district
//   { type: 'district', value: NO_DISTRICT } — cities with no district
//   { type: 'city', value: <name> }     — a single city

// Admin-defined display order for districts. Districts NOT listed here are shown
// after these, alphabetically (Hebrew). Names must match cities.district exactly.
export const DISTRICT_ORDER = [
  'בני ברק',
  'מרכז',
  'ירושלים',
  'סובב ירושלים',
  'צפון',
  'דרום קרוב',
  'דרום',
  // מחוזות חדשים: הוסף כאן בסוף הרשימה (שמות שלא ברשימה מופיעים אחרי אלה לפי א-ב,
  // ולפני קבוצת "ללא מחוז" שתמיד אחרונה).
]

export const NO_DISTRICT = '__none__'      // sentinel: cities without a district
export const NO_DISTRICT_LABEL = 'ללא מחוז'

export const ALL_SELECTION = { type: 'all' }

// Build a Map<cityName, district|null> from bootstrap.cities.
export function buildCityDistrictMap(cities) {
  const map = new Map()
  for (const c of Array.isArray(cities) ? cities : []) {
    if (c && c.name) map.set(c.name, c.district || null)
  }
  return map
}

// Order district names by DISTRICT_ORDER, then alphabetically (Hebrew).
export function orderDistricts(names) {
  const idx = new Map(DISTRICT_ORDER.map((n, i) => [n, i]))
  return [...new Set((names || []).filter(Boolean))].sort((a, b) => {
    const ia = idx.has(a) ? idx.get(a) : Infinity
    const ib = idx.has(b) ? idx.get(b) : Infinity
    if (ia !== ib) return ia - ib
    return a.localeCompare(b, 'he')
  })
}

// Group present city names into ordered district buckets for the picker:
//   [{ district: 'צפון', cities: [...] }, …, { district: NO_DISTRICT, cities: [...] }]
// Only districts that actually have present cities are included; the no-district
// bucket (if any) is always appended last.
export function groupCitiesByDistrict(cityNames, cityDistrictMap) {
  const byDistrict = new Map()   // district -> string[]
  const noDistrict = []
  for (const city of cityNames || []) {
    const d = cityDistrictMap?.get(city) || null
    if (d) {
      if (!byDistrict.has(d)) byDistrict.set(d, [])
      byDistrict.get(d).push(city)
    } else {
      noDistrict.push(city)
    }
  }
  const sortHe = (a, b) => a.localeCompare(b, 'he')
  const groups = orderDistricts([...byDistrict.keys()]).map(d => ({
    district: d,
    cities: byDistrict.get(d).sort(sortHe),
  }))
  if (noDistrict.length) {
    groups.push({ district: NO_DISTRICT, cities: noDistrict.sort(sortHe) })
  }
  return groups
}

// Does a card/row's city match the given selection? Used by every filter.
export function matchesCitySelection(sel, cityDistrictMap, cityName) {
  if (!sel || sel.type === 'all') return true
  if (sel.type === 'city') return cityName === sel.value
  if (sel.type === 'district') {
    const d = cityDistrictMap?.get(cityName) || null
    return sel.value === NO_DISTRICT ? !d : d === sel.value
  }
  return true
}

// Short label for a selection (button summary / report column labels).
export function selectionLabel(sel) {
  if (!sel || sel.type === 'all') return 'כל הערים'
  if (sel.type === 'city') return sel.value
  if (sel.type === 'district') {
    return sel.value === NO_DISTRICT ? NO_DISTRICT_LABEL : `מחוז ${sel.value}`
  }
  return 'כל הערים'
}
