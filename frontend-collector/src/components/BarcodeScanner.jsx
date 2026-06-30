import React, { useEffect, useRef, useState } from 'react'
// Polyfill installs window.BarcodeDetector on browsers that don't already
// expose it (Chrome Desktop on Windows/Linux, Firefox, Safari). On
// platforms that DO have native BarcodeDetector (Chrome on Android,
// Edge) the polyfill detects that and bows out — native always wins.
// Internally the polyfill uses zxing-wasm so it's fast and supports
// scanning at any orientation.
import 'barcode-detector/polyfill'
import Quagga from '@ericblade/quagga2'
import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
import { logger } from '../utils/logger'

// Two-tier decoder:
//   1. Native BarcodeDetector API — available in Chrome 83+ / Edge / Samsung
//      Internet. Backed by ML Kit on Android (hardware-accelerated), so it
//      runs much faster than any JS library and is unaffected by NetFree's
//      card-injection.js (which breaks JS URL/Worker creation that Quagga
//      depends on for its asm.js workers).
//   2. Quagga2 fallback — purpose-built JS scanner for 1D Code 128, used
//      when BarcodeDetector isn't available (older browsers, Firefox, etc.).
//
// Both restricted to Code 128 since that's what the collector barcodes use,
// which makes detection faster and reduces false positives.

// Envelope numbers are ALWAYS exactly 6 digits. A scan that yields any other
// number of digits is not one of our envelopes — e.g. a cash-box (kupa) number
// or a stray product barcode caught in frame — so we ignore it and keep
// scanning rather than accepting it. normalizeEnvelopeCode returns the clean
// 6-digit string when valid, or null otherwise.
const ENVELOPE_DIGITS = 6
function normalizeEnvelopeCode(value) {
  const digits = String(value).replace(/\D/g, '')
  return digits.length === ENVELOPE_DIGITS ? digits : null
}

async function ensureCameraPermission() {
  if (!Capacitor.isNativePlatform()) {
    logger.log('scanner', 'web platform — skipping native permission')
    return { ok: true }
  }
  try {
    const status = await Camera.checkPermissions()
    logger.log('scanner', 'checkPermissions →', status)
    if (status.camera === 'granted' || status.camera === 'limited') return { ok: true }
    if (status.camera === 'denied') {
      return { ok: false, error: 'הרשאת המצלמה נחסמה — יש לאפשר בהגדרות האפליקציה' }
    }
    const req = await Camera.requestPermissions({ permissions: ['camera'] })
    logger.log('scanner', 'requestPermissions →', req)
    if (req.camera === 'granted' || req.camera === 'limited') return { ok: true }
    return { ok: false, error: 'הרשאת המצלמה נדחתה' }
  } catch (e) {
    logger.error('scanner', 'permission API threw', e?.message || String(e))
    return { ok: false, error: e?.message || 'שגיאה בבקשת הרשאת מצלמה' }
  }
}

export default function BarcodeScanner({ onScan, onClose }) {
  const targetRef  = useRef(null)
  const videoRef   = useRef(null)
  const streamRef  = useRef(null)
  const detectorRef = useRef(null)
  const onScanRef  = useRef(onScan)
  const handledRef = useRef(false)
  const startedRef = useRef(false)
  const [error, setError] = useState(null)
  const [stage, setStage] = useState('פותח מצלמה...')
  // Which decoder ended up driving the camera. Determines which DOM
  // element renders — empty unused elements were sitting absolute on
  // top of the active one and hiding the live preview.
  const [mode, setMode] = useState(null) // 'native' | 'quagga' | null

  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => {
    let cancelled = false
    let detectedHandler = null
    let processedHandler = null
    let frameCount = 0
    const tickStart = Date.now()
    let usingNative = false
    let rafId = null

    async function startNativeDetector() {
      // Manage the camera ourselves and feed the video element into the
      // browser's BarcodeDetector. No JS workers, no asm.js — runs on the
      // platform's native scanner.
      setStage('בודק הרשאת מצלמה...')
      const perm = await ensureCameraPermission()
      if (cancelled) return false
      if (!perm.ok) { setError(perm.error); return true }

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
      }
      logger.log('scanner', 'native BarcodeDetector — getUserMedia')
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err) {
        logger.error('scanner', 'getUserMedia failed', err?.name, err?.message)
        // Try minimal fallback once
        try {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } catch (err2) {
          logger.error('scanner', 'getUserMedia minimal also failed', err2?.message)
          setError('לא ניתן לפתוח מצלמה: ' + (err2?.message || ''))
          return true
        }
      }
      if (cancelled) return true

      const video = videoRef.current
      video.srcObject = streamRef.current
      await video.play().catch((e) => logger.error('scanner', 'video.play threw', e?.message))
      logger.log('scanner', 'video w/h:', video.videoWidth, video.videoHeight)

      setStage('מוכן לסריקה')
      logger.log('scanner', 'BarcodeDetector loop started')

      const detect = async () => {
        if (cancelled || handledRef.current) return
        if (!video.videoWidth) {
          rafId = requestAnimationFrame(detect)
          return
        }
        const frameStart = Date.now()
        try {
          const codes = await detectorRef.current.detect(video)
          if (cancelled || handledRef.current) return
          if (codes && codes.length > 0) {
            const c = codes[0]
            const value = c.rawValue || c.rawData || ''
            if (value) {
              const normalized = normalizeEnvelopeCode(value)
              if (!normalized) {
                // Not exactly 6 digits — not an envelope. Skip and keep scanning.
                logger.log('scanner', `IGNORED [${c.format || 'code_128'}] (need ${ENVELOPE_DIGITS} digits):`, value)
                rafId = requestAnimationFrame(detect)
                return
              }
              handledRef.current = true
              logger.log('scanner', `SCAN [${c.format || 'code_128'}]:`, normalized)
              try { streamRef.current?.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
              onScanRef.current?.(normalized)
              return
            }
          }
          frameCount++
          if (frameCount % 20 === 0) {
            const fps = Math.round((frameCount * 1000) / (Date.now() - tickStart))
            logger.log('scanner', `${frameCount} frames @ ${fps}fps, last ${Date.now() - frameStart}ms (native)`)
          }
        } catch (e) {
          logger.error('scanner', 'detector.detect threw', e?.message)
        }
        rafId = requestAnimationFrame(detect)
      }
      detect()
      return true
    }

    async function startQuagga() {
      setStage('בודק הרשאת מצלמה...')
      const perm = await ensureCameraPermission()
      if (cancelled) return
      if (!perm.ok) {
        logger.error('scanner', 'permission failed:', perm.error)
        setError(perm.error)
        return
      }

      setStage('מאתחל סורק...')
      try {
        await new Promise((resolve, reject) => {
          Quagga.init({
            inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target: targetRef.current,
              constraints: {
                facingMode: 'environment',
                width:  { ideal: 1280 },
                height: { ideal: 720 },
              },
              area: {
                // Search the entire frame (no cropping). Quagga's Locator
                // handles finding the barcode wherever it is.
                top:    '0%',
                right:  '0%',
                bottom: '0%',
                left:   '0%',
              },
            },
            locator: {
              // halfSample=false: scan at full resolution. With true,
              // Quagga downscaled 1280×720 → 640×360 first, which made
              // a normal-sized barcode too small for its detector to find
              // (`located=false` on every frame).
              // patchSize='small': look for barcodes in smaller patches —
              // catches barcodes that don't fill the screen.
              patchSize: 'small',
              halfSample: false,
            },
            // Parallel decoders running in Web Workers — each gets a frame
            // and tries to decode. 4 covers most devices; fewer on weak ones.
            numOfWorkers: navigator.hardwareConcurrency
              ? Math.max(2, Math.min(4, navigator.hardwareConcurrency - 1))
              : 2,
            frequency: 15, // decode attempts per second
            decoder: {
              readers: ['code_128_reader'], // ONLY Code 128 — much faster
              multiple: false,
            },
            locate: true, // find the barcode anywhere in any orientation
          }, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
        if (cancelled) return

        logger.log('scanner', 'Quagga.init OK — starting')
        Quagga.start()
        startedRef.current = true
        setStage('מוכן לסריקה')

        detectedHandler = (data) => {
          if (handledRef.current) return
          const code = data?.codeResult?.code
          if (!code) return
          const normalized = normalizeEnvelopeCode(code)
          if (!normalized) {
            // Not exactly 6 digits — not an envelope. Skip and keep scanning.
            logger.log('scanner', `IGNORED [Code128] (need ${ENVELOPE_DIGITS} digits): ${code}`)
            return
          }
          handledRef.current = true
          logger.log('scanner', `SCAN [Code128]: ${normalized}`)
          try { Quagga.stop() } catch { /* ignore */ }
          startedRef.current = false
          onScanRef.current?.(normalized)
        }
        processedHandler = (result) => {
          frameCount++
          if (frameCount % 20 === 0) {
            const fps = Math.round((frameCount * 1000) / (Date.now() - tickStart))
            const located = !!result?.boxes?.length
            logger.log('scanner', `${frameCount} frames @ ${fps}fps, located=${located}`)
          }
        }
        Quagga.onDetected(detectedHandler)
        Quagga.onProcessed(processedHandler)
      } catch (e) {
        if (cancelled) return
        logger.error('scanner', 'Quagga.init REJECTED', e?.name || '', e?.message || String(e))
        setError((e?.message || 'שגיאה באתחול הסורק'))
      }
    }

    async function orchestrate() {
      logger.log('scanner', '=== mount ===')
      logger.log('scanner', 'native?', Capacitor.isNativePlatform(), 'platform:', Capacitor.getPlatform())

      // Prefer native BarcodeDetector when the browser provides it. Test
      // both presence AND that Code 128 is a supported format — some
      // browsers expose the API but only support a subset.
      let canUseNative = false
      try {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          const supported = await window.BarcodeDetector.getSupportedFormats()
          logger.log('scanner', 'BarcodeDetector supported formats:', JSON.stringify(supported))
          if (Array.isArray(supported) && supported.includes('code_128')) {
            detectorRef.current = new window.BarcodeDetector({ formats: ['code_128'] })
            canUseNative = true
          }
        } else {
          logger.log('scanner', 'window.BarcodeDetector not available')
        }
      } catch (e) {
        logger.error('scanner', 'BarcodeDetector init threw', e?.message)
      }

      if (canUseNative) {
        usingNative = true
        setMode('native')
        logger.log('scanner', 'using NATIVE BarcodeDetector (Code128)')
        await startNativeDetector()
      } else {
        setMode('quagga')
        logger.log('scanner', 'falling back to Quagga2 (Code128)')
        await startQuagga()
      }
    }
    orchestrate()

    return () => {
      cancelled = true
      logger.log('scanner', '=== unmount ===')
      if (usingNative) {
        if (rafId) cancelAnimationFrame(rafId)
        try { streamRef.current?.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
        streamRef.current = null
        if (videoRef.current) {
          try { videoRef.current.srcObject = null } catch { /* ignore */ }
        }
      } else {
        try { if (detectedHandler)  Quagga.offDetected(detectedHandler) } catch { /* ignore */ }
        try { if (processedHandler) Quagga.offProcessed(processedHandler) } catch { /* ignore */ }
        try { if (startedRef.current) Quagga.stop() } catch { /* ignore */ }
        startedRef.current = false
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
      >✕</button>
      <div className="scanner-hint">{error ? '❌ ' + stage : stage}</div>
      {/* Both surfaces are kept in the DOM so refs are always available, but
          only the active decoder's surface is shown — an unused empty
          video/div sitting absolute on top of the live one was hiding the
          live preview. display:none on the inactive surface removes it
          from layout entirely. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          display: mode === 'native' ? 'block' : 'none',
          position: 'absolute', inset: 0,
          width: '100%', height: '100%', objectFit: 'cover',
        }}
      />
      <div
        ref={targetRef}
        style={{
          display: mode === 'quagga' ? 'flex' : 'none',
          position: 'absolute', inset: 0,
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      />
      {error && (
        <div className="alert red" style={{ position: 'absolute', left: 16, right: 16, bottom: 80 }}>
          {error}
        </div>
      )}
    </div>
  )
}
