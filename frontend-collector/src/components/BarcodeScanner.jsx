import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const handledRef = useRef(false)
  const onScanRef = useRef(onScan)
  const [error, setError] = useState(null)

  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => {
    let cancelled = false
    let reader = null
    const startTimer = setTimeout(() => {
      if (cancelled) return
      reader = new BrowserMultiFormatReader()
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
      }
      reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, err, ctrls) => {
          if (cancelled || handledRef.current) return
          if (result) {
            handledRef.current = true
            const value = result.getText()
            try { ctrls?.stop?.() } catch { /* ignore */ }
            onScanRef.current?.(value)
          }
        }
      ).then((controls) => {
        if (cancelled) {
          try { controls.stop() } catch { /* ignore */ }
          return
        }
        controlsRef.current = controls
      }).catch((e) => {
        if (cancelled) return
        setError(e?.message || 'לא ניתן לגשת למצלמה')
      })
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      const controls = controlsRef.current
      controlsRef.current = null
      if (controls) {
        try { controls.stop() } catch { /* ignore */ }
      }
      const v = videoRef.current
      const stream = v && v.srcObject
      if (stream && typeof stream.getTracks === 'function') {
        try { stream.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
        try { v.srcObject = null } catch { /* ignore */ }
      }
    }
  }, [])

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
