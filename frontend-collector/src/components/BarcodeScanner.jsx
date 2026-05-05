import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const handledRef = useRef(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    async function start() {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err, ctrls) => {
            if (cancelled || handledRef.current) return
            if (result) {
              handledRef.current = true
              const value = result.getText()
              try { ctrls?.stop?.() } catch { /* ignore */ }
              onScan?.(value)
            }
          }
        )
        if (cancelled) {
          try { controls.stop() } catch { /* ignore */ }
          return
        }
        controlsRef.current = controls
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'לא ניתן לגשת למצלמה')
      }
    }

    start()

    return () => {
      cancelled = true
      try { controlsRef.current?.stop?.() } catch { /* ignore */ }
    }
  }, [onScan])

  return (
    <div className="scanner-screen">
      <button
        type="button"
        className="scanner-close"
        onClick={onClose}
        aria-label="סגור"
      >
        ✕
      </button>
      <div className="scanner-hint">כוון את המצלמה אל הברקוד</div>
      <video ref={videoRef} playsInline muted autoPlay />
      {error && (
        <div className="alert red" style={{ position: 'absolute', left: 16, right: 16, bottom: 80 }}>
          {error}
        </div>
      )}
    </div>
  )
}
