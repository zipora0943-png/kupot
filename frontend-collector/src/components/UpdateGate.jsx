import React, { useEffect, useState, useCallback } from 'react'
import { checkServerVersion, getDismissedVersion, setDismissedVersion } from '../utils/versionCheck'
import { installApk, isNativeAndroid } from '../utils/apkInstaller'
import UpdateBanner from './UpdateBanner'
import UpdateModal  from './UpdateModal'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

// Polls the server for new versions and surfaces a banner (optional update)
// or a blocking modal (mandatory, when current < min_supported_version).
//
// Rendered once at the app root. Silent on network errors — never blocks
// the app when the version endpoint is unreachable.
export default function UpdateGate() {
  const [state, setState]   = useState(null)
  const [showModal, setShow] = useState(false)

  const runCheck = useCallback(async () => {
    const result = await checkServerVersion()
    if (!result.hasUpdate) return
    setState(result)
    if (result.isMandatory) {
      setShow(true)
    } else {
      // If the user already dismissed this exact version, keep it hidden.
      const dismissed = getDismissedVersion()
      if (dismissed === result.latest.version) {
        setState(null)
      }
    }
  }, [])

  useEffect(() => {
    // Version banners/modals only make sense inside the installable APK — in the
    // browser the user gets the latest code on every page load, so an update
    // prompt (and especially a mandatory one) is wrong there.
    if (!isNativeAndroid()) return undefined
    runCheck()
    const t = setInterval(runCheck, CHECK_INTERVAL_MS)
    return () => clearInterval(t)
  }, [runCheck])

  const handleDismiss = () => {
    if (state?.latest?.version) setDismissedVersion(state.latest.version)
    setState(null)
  }

  const handleUpdateFromBanner = async () => {
    if (isNativeAndroid()) {
      // Open the modal — it shows progress while the APK downloads + installs.
      setShow(true)
      return
    }
    // Web: just reload.
    try { await installApk(state?.latest?.apk_url) } catch { /* ignore */ }
    window.location.reload()
  }

  if (!state) return null

  if (showModal) {
    return (
      <UpdateModal
        latest={state.latest}
        current={state.current}
        isMandatory={state.isMandatory}
        onCancel={() => setShow(false)}
      />
    )
  }

  return (
    <UpdateBanner
      latestVersion={state.latest.version}
      onUpdate={handleUpdateFromBanner}
      onDismiss={handleDismiss}
    />
  )
}
