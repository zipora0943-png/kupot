// ===== Alert notifications (new task / new report) =====
// Two delivery paths, chosen by whether the app is currently in the foreground:
//   - Foreground (screen visible): an in-app banner (rendered by
//     AppNotifications.jsx) plus a short synthesized "bell" chime via Web Audio.
//   - Background (app alive but not visible): a real system-tray notification
//     via @capacitor/local-notifications, which carries the OS notification
//     sound.
//
// Local notifications are a pure OS API (NotificationManager) — they do NOT
// need Google Play Services, so they work on the field devices (which return
// SERVICE_INVALID for Play Services). A fully force-closed app still cannot be
// woken — that would require FCM, which is unavailable here.

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { logger } from './logger'

// ─── bell sound (Web Audio, no asset file) ───────────────────────────
let audioCtx = null
let unlockInstalled = false

function getCtx() {
  if (audioCtx) return audioCtx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try { audioCtx = new AC() } catch { audioCtx = null }
  return audioCtx
}

// Mobile WebViews start the AudioContext suspended until a user gesture. Resume
// it once on the first touch/click so the first bell is audible.
export function initAudioUnlock() {
  if (unlockInstalled) return
  unlockInstalled = true
  const resume = () => {
    const ctx = getCtx()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  }
  window.addEventListener('pointerdown', resume, { once: true, passive: true })
  window.addEventListener('touchstart', resume, { once: true, passive: true })
}

// A short two-partial bell: a fundamental plus an octave, each with an
// exponential decay so it rings rather than beeps.
export function playBell() {
  try {
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const now = ctx.currentTime
    const partials = [
      { freq: 880, peak: 0.45 },
      { freq: 1760, peak: 0.18 },
    ]
    for (const { freq, peak } of partials) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 1.15)
    }
  } catch { /* ignore — sound is best-effort */ }
}

// ─── system notification (background) ────────────────────────────────
let permState = null // 'granted' | 'denied' | null (unknown / not asked)

export function isNative() {
  return Capacitor.isNativePlatform()
}

// Ask for the POST_NOTIFICATIONS permission once (Android 13+). Cached so we
// don't re-prompt. Safe to call on web — resolves false.
export async function ensureNotifPermission() {
  if (!isNative()) return false
  if (permState === 'granted') return true
  try {
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions()
    }
    permState = perm.display === 'granted' ? 'granted' : 'denied'
    return permState === 'granted'
  } catch (err) {
    logger.log('notify', 'permission error', err?.message || String(err))
    return false
  }
}

// Post an immediate system-tray notification with the default OS sound.
export async function postSystemNotification({ title, body }) {
  if (!isNative()) return
  try {
    const granted = await ensureNotifPermission()
    if (!granted) return
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2_000_000_000),
          title,
          body,
          // no `schedule` ⇒ fire immediately; default channel carries sound.
        },
      ],
    })
  } catch (err) {
    logger.log('notify', 'schedule error', err?.message || String(err))
  }
}

// True when the WebView is hidden (app backgrounded / screen off). Used to pick
// the system-notification path over the in-app banner.
export function appIsHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}
