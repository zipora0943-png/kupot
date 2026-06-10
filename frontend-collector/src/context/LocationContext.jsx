import React, {
  createContext, useContext, useEffect, useRef, useState,
} from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { useAuth } from '@shared/context/AuthContext'

// Continuous GPS tracker. Starts when the user is authenticated and the app
// is foregrounded; pauses when the app is hidden so we don't drain the
// battery in the user's pocket. Pages that need a position read it straight
// out of this context — no per-action GPS warm-up wait.
//
// Note on battery: watchPosition with enableHighAccuracy=true keeps the GPS
// chip on. Typical drain ≈ 100–200 mA. For a collector who's actively
// scanning, this is the right trade-off; for an admin idly browsing the
// admin app, no — but the admin app doesn't mount this provider.

const LocationContext = createContext(null)

const STALE_AFTER_MS = 30_000  // a fix older than 30s is "stale" but still
                                // usable while a fresh one is acquiring.

export function LocationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [state, setState] = useState({
    lat: null,
    lng: null,
    accuracy: null,
    updatedAt: null,
    error: null,
  })
  const watchIdRef = useRef(null)
  const visibleRef = useRef(typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    if (!isAuthenticated) return undefined
    let cancelled = false

    async function startWatch() {
      // Seed with whatever cached fix the OS has so the very first read is
      // instant, even before the first satellite update arrives.
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 2000,
          maximumAge: 60_000,
        })
        if (cancelled) return
        if (pos?.coords && Number.isFinite(pos.coords.latitude)) {
          setState({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            updatedAt: Date.now(),
            error: null,
          })
        }
      } catch { /* no cached fix; continuous watch below will fill in */ }

      try {
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 30_000, maximumAge: 5_000 },
          (pos, err) => {
            if (cancelled) return
            if (err) {
              setState((s) => ({ ...s, error: err.message || 'gps_error' }))
              return
            }
            if (!pos?.coords) return
            const { latitude, longitude, accuracy } = pos.coords
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
            setState({
              lat: latitude, lng: longitude,
              accuracy, updatedAt: Date.now(), error: null,
            })
          },
        )
        if (cancelled) {
          Geolocation.clearWatch({ id }).catch(() => {})
          return
        }
        watchIdRef.current = id
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, error: err?.message || 'watch_failed' }))
      }
    }

    function stopWatch() {
      const id = watchIdRef.current
      watchIdRef.current = null
      if (id) Geolocation.clearWatch({ id }).catch(() => {})
    }

    // Pause/resume on visibility — saves battery while the app is in the
    // background or another app is on screen.
    function handleVisibility() {
      const visible = !document.hidden
      if (visible && !visibleRef.current) {
        visibleRef.current = true
        startWatch()
      } else if (!visible && visibleRef.current) {
        visibleRef.current = false
        stopWatch()
      }
    }

    if (visibleRef.current) startWatch()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      stopWatch()
    }
  }, [isAuthenticated])

  return (
    <LocationContext.Provider value={state}>
      {children}
    </LocationContext.Provider>
  )
}

export function useCurrentLocation() {
  return useContext(LocationContext)
}

// Read the latest known position, returning null if we don't have one yet.
// Pass `{ requireFresh: true }` to reject fixes older than 30 s.
export function useLatestPosition({ requireFresh = false } = {}) {
  const loc = useContext(LocationContext)
  if (!loc || loc.lat == null) return null
  if (requireFresh && Date.now() - loc.updatedAt > STALE_AFTER_MS) return null
  return { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, updatedAt: loc.updatedAt }
}
