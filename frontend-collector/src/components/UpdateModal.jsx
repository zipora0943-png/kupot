import React, { useState } from 'react'
import { installApk, isNativeAndroid } from '../utils/apkInstaller'

// Update flow:
//  - Android native → download + install APK via ApkInstaller plugin (in-app)
//  - Web            → reload the page; the new build is served by the host
//
// `isMandatory` removes the cancel button and disables the backdrop close, so
// the user must run the update before continuing.
export default function UpdateModal({ latest, current, isMandatory, onCancel }) {
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState(null)
  const [progress, setProgress] = useState(null)

  const handleUpdate = async () => {
    setError(null)
    setBusy(true)
    try {
      if (isNativeAndroid()) {
        setProgress('מוריד את הגרסה החדשה…')
        await installApk(latest.apk_url)
        setProgress('מפעיל את מסך ההתקנה…')
      } else {
        setProgress('טוען מחדש את האפליקציה…')
        // Force a fresh fetch (skip cache) so the new build's index.html is loaded.
        setTimeout(() => window.location.reload(), 300)
      }
    } catch (err) {
      setError(err?.message || 'העדכון נכשל. נסה שוב.')
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="modal-backdrop" onClick={isMandatory ? undefined : onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isMandatory ? '🔒 עדכון חובה' : '🆕 גרסה חדשה זמינה'}</h3>
        </div>

        <div className="update-modal-body">
          <p><strong>גרסה חדשה:</strong> {latest?.version}</p>
          <p><strong>גרסה מותקנת:</strong> {current}</p>
          {latest?.release_notes && (
            <div className="update-notes">
              <div className="update-notes-title">מה חדש:</div>
              <div className="update-notes-text">{latest.release_notes}</div>
            </div>
          )}
          {isMandatory && (
            <div className="alert warn">
              גרסה זו אינה נתמכת יותר. יש להתקין את הגרסה החדשה כדי להמשיך להשתמש באפליקציה.
            </div>
          )}
          {progress && <div className="alert info">{progress}</div>}
          {error && <div className="alert red">{error}</div>}
        </div>

        <div className="modal-footer">
          {!isMandatory && (
            <button className="btn" onClick={onCancel} disabled={busy}>לא עכשיו</button>
          )}
          <button className="btn primary" onClick={handleUpdate} disabled={busy}>
            {busy ? 'מעדכן…' : 'התקן עכשיו'}
          </button>
        </div>
      </div>
    </div>
  )
}
