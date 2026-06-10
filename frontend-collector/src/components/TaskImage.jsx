import React, { useEffect, useState } from 'react'
import { assetUrl } from '../utils/assetUrl'

// Why fetch → blob instead of <img src=URL> directly:
// On the Android WebView the production server's /uploads/ URL would not
// render inline even though tapping the same URL in the system browser
// worked. Going through fetch() + URL.createObjectURL bypasses whatever the
// WebView was doing wrong (mixed-content quirk, NetFree filter, etc.) — we
// download the bytes via the same code path the API client already uses and
// hand the WebView a local blob: URL that it always renders.
//
// On failure we surface a tap-to-open card so the collector can still view
// the image in the system browser.
export default function TaskImage({ path, label = 'תמונה' }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed,  setFailed]  = useState(false)
  const remoteUrl = path ? assetUrl(path) : null

  useEffect(() => {
    if (!remoteUrl) return undefined
    let cancelled = false
    let createdUrl = null

    async function load() {
      setLoading(true)
      setFailed(false)
      try {
        const token = localStorage.getItem('kupot_token')
        const res = await fetch(remoteUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        setBlobUrl(createdUrl)
      } catch (err) {
        if (cancelled) return
        console.warn('[TaskImage] fetch failed:', err?.message)
        setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [remoteUrl])

  if (!path) return null

  if (loading) {
    return (
      <div style={{
        padding: 14,
        textAlign: 'center',
        color: 'var(--text3, #6b7280)',
        border: '1px dashed var(--border, #e5e7eb)',
        borderRadius: 8,
        fontSize: 13,
      }}>טוען תמונה...</div>
    )
  }

  if (failed) {
    return (
      <a
        href={remoteUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 8,
          background: 'var(--bg2, #f9fafb)',
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <span style={{ fontSize: 24 }}>📷</span>
        <span style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text3, #6b7280)' }}>
            לא ניתן לטעון בתוך האפליקציה — הקש לפתיחה בדפדפן
          </div>
        </span>
        <span style={{ fontSize: 18, color: 'var(--text3, #6b7280)' }}>↗</span>
      </a>
    )
  }

  return (
    <a href={remoteUrl} target="_blank" rel="noopener noreferrer">
      <img
        src={blobUrl}
        alt={label}
        style={{
          maxWidth: '100%',
          maxHeight: 300,
          borderRadius: 8,
          border: '1px solid var(--border, #e5e7eb)',
          display: 'block',
        }}
      />
    </a>
  )
}
