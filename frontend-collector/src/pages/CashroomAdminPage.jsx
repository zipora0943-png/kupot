import React, { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import CashroomPage from '@shared/pages/CashroomPage'
import BarcodeScanner from '../components/BarcodeScanner'

// "Device detection": only offer camera scanning where a camera is actually
// usable — the native APK, or a browser that exposes getUserMedia. On anything
// else (and on the admin panel, which never injects this) the button is hidden
// and the text field + barcode reader is the only path.
const CAMERA_AVAILABLE =
  (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia) ||
  Capacitor.isNativePlatform()

// Camera-scan control injected into the shared cashroom page's scan panel.
// Owns its own open/close state; a successful scan feeds the value straight
// into the page's lookup (same path as typing + Enter).
function CameraScanControl({ performLookup, scanning }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="btn cashroom-camera-btn"
        onClick={() => setOpen(true)}
        disabled={scanning}
        aria-label="פתח מצלמה לסריקה"
      >
        📷 <span>סריקת מצלמה</span>
      </button>
      {open && (
        <BarcodeScanner
          onScan={(value) => { setOpen(false); performLookup(value) }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default function CashroomAdminPage() {
  return (
    <CashroomPage
      renderScanExtra={CAMERA_AVAILABLE
        ? (ctx) => <CameraScanControl {...ctx} />
        : null}
    />
  )
}
