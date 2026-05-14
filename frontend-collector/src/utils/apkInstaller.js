// Bridge to the native ApkInstaller plugin (android/app/.../ApkInstallerPlugin.java).
//
// On Android: downloads the APK to cache and launches the system installer —
// the user stays inside the app's process. No browser involved.
// On web/iOS: returns false so callers can fall back to a "reload" prompt
// (web build) or no-op (unsupported).

import { Capacitor, registerPlugin } from '@capacitor/core'

const ApkInstaller = registerPlugin('ApkInstaller')

export function isNativeAndroid() {
  try {
    return Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}

// Resolve a manifest `apk_url` (often a server-relative path like
// "/downloads/collector-1.0.2.apk") to a fully-qualified URL the native
// downloader can hit. Falls back to VITE_API_BASE host on relative URLs.
export function resolveApkUrl(apkUrl) {
  if (!apkUrl) return null
  if (/^https?:\/\//i.test(apkUrl)) return apkUrl
  const base = import.meta.env.VITE_API_BASE || ''
  // VITE_API_BASE looks like "http://host:port/api". The APK lives at /downloads/...
  // off the same host, so strip the trailing /api (if any).
  const origin = base.replace(/\/api\/?$/, '')
  return origin + (apkUrl.startsWith('/') ? apkUrl : '/' + apkUrl)
}

// Triggers the native download + install. Resolves once the installer is
// launched (the user still has to tap "Install" in the system UI).
export async function installApk(apkUrl) {
  if (!isNativeAndroid()) {
    throw new Error('עדכון APK זמין רק במכשיר אנדרואיד')
  }
  const url = resolveApkUrl(apkUrl)
  if (!url) throw new Error('כתובת APK חסרה במניפסט הגרסה')
  return ApkInstaller.installFromUrl({ url })
}

export default ApkInstaller
