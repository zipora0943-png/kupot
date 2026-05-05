export function daysSince(dateStr) {
  if (dateStr == null) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const ms = Date.now() - d.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / 86400000)
}
