import React, { useEffect, useState, useRef } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { settings as settingsApi } from '@app-api/endpoints'

// Cache the API key across mounts so we don't refetch on every render.
// IMPORTANT: only cache successful (non-empty) responses. A failure or empty
// key must retry on the next mount — otherwise the admin can save the key
// and the map will still say "not configured" until a full page refresh.
let cachedKey = null
let inflight = null
function fetchMapsKey() {
  if (cachedKey) return Promise.resolve(cachedKey)
  if (inflight) return inflight
  inflight = settingsApi.getMapsKey()
    .then((r) => {
      const k = r?.key || ''
      if (k) cachedKey = k
      return k
    })
    .catch((err) => {
      console.error('[MapView] failed to fetch Google Maps API key:', err?.message || err)
      return ''
    })
    .finally(() => { inflight = null })
  return inflight
}

// Re-center the map whenever the input coords change externally
// (e.g. parent triggered a re-geocode). When the user just dragged the
// marker we don't want to recenter, so the parent should hold the new
// coords as the source of truth.
function Recenter({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.panTo({ lat, lng })
    }
  }, [lat, lng, map])
  return null
}

/**
 * Embeddable Google Maps view. Loads the Google Maps JS API on first mount
 * (cached for the rest of the SPA session) using the key from /api/settings.
 *
 * Props:
 *   lat, lng (numbers, required) — marker + initial center.
 *   zoom        (number, default 17) — initial zoom level.
 *   height      (string|number, default 240) — map container height.
 *   popupText   (string, optional) — content of the marker info-window
 *                                    (currently surfaced only as marker title
 *                                    in the AdvancedMarker mode).
 *   interactive (boolean, default true) — when false, disables zoom/drag,
 *                                         useful for thumbnail-style displays.
 *   draggable   (boolean, default false) — when true, the marker can be
 *                                          dragged to fine-tune the location.
 *   onMarkerDrag(lat, lng) — callback fired when the marker drag ends.
 */
export default function MapView({
  lat,
  lng,
  zoom = 17,
  height = 240,
  popupText,
  interactive = true,
  draggable = false,
  onMarkerDrag,
}) {
  const [apiKey, setApiKey] = useState(null) // null = loading, '' = missing
  const containerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetchMapsKey().then((k) => {
      if (!cancelled) setApiKey(k || '')
    })
    return () => { cancelled = true }
  }, [])

  const latN = Number(lat)
  const lngN = Number(lng)

  const containerStyle = {
    height,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--bg2, #f3f4f6)',
  }

  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
    return (
      <div ref={containerRef} style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3, #6b7280)', fontSize: 13 }}>
        אין קואורדינטות להצגה
      </div>
    )
  }

  if (apiKey === null) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3, #6b7280)', fontSize: 13 }}>
        טוען מפה...
      </div>
    )
  }
  if (apiKey === '') {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3, #6b7280)', fontSize: 13, padding: 12, textAlign: 'center' }}>
        לא ניתן להציג מפה — מפתח Google Maps API לא הוגדר בהגדרות.
      </div>
    )
  }

  // The mapId is required for AdvancedMarker; use a stable placeholder ID.
  // For default styling, "DEMO_MAP_ID" is allowed by Google for development;
  // for production you may want to create a real Map ID in Google Cloud Console.
  const mapId = 'DEMO_MAP_ID'

  return (
    <div style={containerStyle}>
      <APIProvider apiKey={apiKey} libraries={['marker']}>
        <Map
          defaultCenter={{ lat: latN, lng: lngN }}
          defaultZoom={zoom}
          mapId={mapId}
          gestureHandling={interactive ? 'auto' : 'none'}
          disableDefaultUI={!interactive}
          clickableIcons={interactive}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker
            position={{ lat: latN, lng: lngN }}
            draggable={draggable}
            title={popupText || undefined}
            onDragEnd={(e) => {
              if (!onMarkerDrag) return
              const pos = e.latLng
              if (!pos) return
              // pos.lat / pos.lng may be functions (legacy) or numbers (newer).
              const newLat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
              const newLng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
              if (Number.isFinite(newLat) && Number.isFinite(newLng)) {
                onMarkerDrag(newLat, newLng)
              }
            }}
          />
          <Recenter lat={latN} lng={lngN} />
        </Map>
      </APIProvider>
    </div>
  )
}
