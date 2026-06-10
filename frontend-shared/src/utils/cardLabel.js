/**
 * Card-label utility.
 *
 * Each box may have multiple cards over its lifetime (open → close → reopen at
 * a new location, etc.). The label shown in the UI is `${iron_number}${letter}`
 * (e.g. "1019A", "1019B"), where the letter is assigned per-box in opened_at
 * order (oldest = A).
 *
 * The letter is stored in the DB on `cards.card_letter` (assigned by
 * `openCard()` in cardLogic.js). This utility prefers that DB value when
 * present and falls back to computing the suffix from the ordering — kept so
 * legacy rows missing card_letter (pre-migration) still render correctly.
 */

/**
 * Convert a 0-based index to the suffix letter:
 *   0 → A, 1 → B, …, 25 → Z, 26 → AA, 27 → AB, …
 */
export function letterFromIndex(idx) {
  if (!Number.isFinite(idx) || idx < 0) return ''
  let s = ''
  let n = idx
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
    if (n < 0) break
  }
  return s
}

/**
 * Given an array of cards (each with at least { id, box_id, iron_number, opened_at }),
 * returns a Map<cardId, label> where label is e.g. "1019A".
 *
 * Order within a box: ascending opened_at (oldest first).
 */
export function computeCardLabels(allCards) {
  const labels = new Map()
  if (!Array.isArray(allCards)) return labels

  // Group by box_id
  const byBox = new Map()
  for (const c of allCards) {
    if (!byBox.has(c.box_id)) byBox.set(c.box_id, [])
    byBox.get(c.box_id).push(c)
  }

  // Sort each group by opened_at, then assign letters
  for (const [, cards] of byBox.entries()) {
    cards.sort((a, b) => {
      const da = a.opened_at ? new Date(a.opened_at).getTime() : 0
      const db = b.opened_at ? new Date(b.opened_at).getTime() : 0
      return da - db
    })
    cards.forEach((c, idx) => {
      const iron = c.iron_number || c.box_id
      const letter = c.card_letter || letterFromIndex(idx)
      labels.set(c.id, `${iron}${letter}`)
    })
  }
  return labels
}
