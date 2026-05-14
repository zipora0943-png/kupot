// In-app version check.
// Compares the bundled `import.meta.env.VITE_APP_VERSION` (set in vite.config.js
// from package.json) against the manifest served at GET /api/version/collector.
//
// Returns: { hasUpdate, isMandatory, latest, current }
//   hasUpdate   — server version is newer than the installed one
//   isMandatory — installed version is below `min_supported_version` (force upgrade)
//   latest      — full manifest from server (or null on error)
//   current     — installed version string

import { version as versionApi } from '@app-api/endpoints'

export function getCurrentVersion() {
  return import.meta.env.VITE_APP_VERSION || '0.0.0'
}

// Compare two semver strings (X.Y.Z). Returns -1, 0, 1.
// Non-numeric / missing segments are treated as 0.
export function compareSemver(a, b) {
  const pa = String(a || '0.0.0').split('.').map(n => Number.parseInt(n, 10) || 0)
  const pb = String(b || '0.0.0').split('.').map(n => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] || 0
    const bi = pb[i] || 0
    if (ai > bi) return 1
    if (ai < bi) return -1
  }
  return 0
}

export async function checkServerVersion() {
  const current = getCurrentVersion()
  try {
    const latest = await versionApi.getCollector()
    if (!latest || !latest.version) {
      return { hasUpdate: false, isMandatory: false, latest: null, current }
    }
    const hasUpdate   = compareSemver(latest.version, current) > 0
    const isMandatory = hasUpdate
      && latest.min_supported_version
      && compareSemver(current, latest.min_supported_version) < 0
    return { hasUpdate, isMandatory: Boolean(isMandatory), latest, current }
  } catch {
    return { hasUpdate: false, isMandatory: false, latest: null, current }
  }
}

// Dismissed-version memory (per-device, not per-user).
// A user can dismiss a non-mandatory update; the same version will not nag
// again until a newer one is released.
const DISMISS_KEY = 'kupot_dismissed_version'

export function getDismissedVersion() {
  try { return localStorage.getItem(DISMISS_KEY) || null } catch { return null }
}

export function setDismissedVersion(v) {
  try { localStorage.setItem(DISMISS_KEY, v) } catch { /* ignore */ }
}
