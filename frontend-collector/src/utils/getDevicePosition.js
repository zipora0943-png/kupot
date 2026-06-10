import { Geolocation } from '@capacitor/geolocation'

// Haversine distance between two WGS84 coordinates, in meters. Matches the
// server-side formula in backend/src/services/distance.js so client-side
// radius decisions agree with what the server would say.
const EARTH_RADIUS_METERS = 6_371_000
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

// Radius the server uses (backend/src/routes/cards.js LOCATION_RADIUS_METERS).
// Kept in sync manually — bump both when adjusting.
export const RADIUS_METERS = 25

// Get a high-accuracy GPS fix using watchPosition so we don't accept the
// first cell-tower triangulation Android hands out (was returning fixes
// 2,000 m off the real position).
//
// Strategy:
//   1. Start watching with enableHighAccuracy: true.
//   2. Keep the best (lowest accuracy radius) fix we see.
//   3. As soon as we get a fix at or below `targetAccuracy` meters, resolve.
//   4. After `maxWait` ms, resolve with whatever we have (or error if nothing).
//
// `onProgress(accuracy)` is called with each better fix so the UI can show
// "מאתר מיקום (דיוק: 120 מ')..." while we wait.

const DEFAULT_TARGET_ACCURACY = 50   // good enough for the 25 m radius check
const DEFAULT_ACCEPT_ACCURACY = 150  // fallback: anything below this is "ok"
const DEFAULT_MAX_WAIT_MS = 15000

export async function getDevicePosition({
  targetAccuracy = DEFAULT_TARGET_ACCURACY,
  acceptAccuracy = DEFAULT_ACCEPT_ACCURACY,
  maxWait = DEFAULT_MAX_WAIT_MS,
  onProgress = null,
} = {}) {
  return new Promise((resolve) => {
    let bestFix = null
    let watchId = null
    let timeoutId = null
    let settled = false

    const settle = (result) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (watchId) {
        Geolocation.clearWatch({ id: watchId }).catch(() => {})
      }
      resolve(result)
    }

    // Try to short-circuit with a cached fix the OS already has — much
    // faster than waiting for a fresh satellite lock. We still kick off
    // watchPosition below so we can replace the cached fix with a better
    // one if it arrives quickly.
    Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 2000,
      maximumAge: 60_000, // accept up to a minute old
    }).then((pos) => {
      if (settled || !pos?.coords) return
      const { latitude, longitude, accuracy } = pos.coords
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        bestFix = { lat: latitude, lng: longitude, accuracy }
        try { onProgress?.(accuracy) } catch { /* ignore */ }
        if (accuracy <= targetAccuracy) settle({ ok: true, ...bestFix })
      }
    }).catch(() => { /* no cached fix; live watch below will fill in */ })

    Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: maxWait, maximumAge: 0 },
      (pos, err) => {
        if (err) {
          // If we already have a usable fix, return it instead of failing.
          if (bestFix && bestFix.accuracy <= acceptAccuracy) {
            settle({ ok: true, ...bestFix })
          } else {
            settle({ ok: false, error: err.message || 'geolocation_failed' })
          }
          return
        }
        if (!pos || !pos.coords) return
        const { latitude, longitude, accuracy } = pos.coords
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

        if (!bestFix || accuracy < bestFix.accuracy) {
          bestFix = { lat: latitude, lng: longitude, accuracy }
          try { onProgress?.(accuracy) } catch { /* ignore */ }
        }
        if (accuracy <= targetAccuracy) {
          settle({ ok: true, ...bestFix })
        }
      },
    ).then((id) => {
      watchId = id
    }).catch((err) => {
      settle({ ok: false, error: err?.message || 'geolocation_failed' })
    })

    timeoutId = setTimeout(() => {
      if (bestFix && bestFix.accuracy <= acceptAccuracy) {
        settle({ ok: true, ...bestFix })
      } else if (bestFix) {
        settle({ ok: false, error: 'low_accuracy', accuracy: bestFix.accuracy })
      } else {
        settle({ ok: false, error: 'timeout' })
      }
    }, maxWait)
  })
}
