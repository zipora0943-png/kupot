// Persistent in-app logger for field debugging.
//
// Why this exists: when the WebView crashes mid-scan there's no logcat the
// user can read in the field. We tee every log line through localStorage so
// even if Chromium dies and restarts the app, the last N lines of the run
// that crashed are still on disk and can be exported via the log viewer.
//
// We also flush new lines to the server (POST /api/client-logs) every few
// seconds so an admin can read them in their browser without touching the
// device. Lines that haven't been flushed yet are kept in a parallel
// `unsent` queue persisted in localStorage too — after a crash + restart
// the next flush picks them up and sends them to the server.

import { API_BASE } from '@shared/api/client'

const STORAGE_KEY        = 'kupot:applog'
const UNSENT_KEY         = 'kupot:applog:unsent'
const LIMIT              = 500
const UNSENT_LIMIT       = 1000   // we can buffer more pending lines than displayed
const FLUSH_INTERVAL_MS  = 5000
const DEBOUNCE_MS        = 200    // also flush ~200ms after the last log line
                                  // so a burst right before a crash still makes
                                  // it to the server

let buffer = loadFromStorage(STORAGE_KEY, LIMIT)
let unsent = loadFromStorage(UNSENT_KEY, UNSENT_LIMIT)
let flushInflight = false
let debouncedFlushId = null

function loadFromStorage(key, limit) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(-limit) : []
  } catch {
    return []
  }
}

function persistBuffer() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer))
  } catch {
    buffer = buffer.slice(-Math.floor(LIMIT / 2))
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer)) } catch { /* give up */ }
  }
}

function persistUnsent() {
  try {
    localStorage.setItem(UNSENT_KEY, JSON.stringify(unsent))
  } catch {
    unsent = unsent.slice(-Math.floor(UNSENT_LIMIT / 2))
    try { localStorage.setItem(UNSENT_KEY, JSON.stringify(unsent)) } catch { /* give up */ }
  }
}

function nowIso() {
  return new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
}

function fmt(args) {
  return args.map((a) => {
    if (a == null) return String(a)
    if (typeof a === 'string') return a
    try { return JSON.stringify(a) } catch { return String(a) }
  }).join(' ')
}

function appendLine(line, isError) {
  if (isError) console.error(line) // eslint-disable-line no-console
  else         console.log(line)   // eslint-disable-line no-console
  buffer.push(line)
  unsent.push(line)
  if (buffer.length > LIMIT) buffer = buffer.slice(-LIMIT)
  if (unsent.length > UNSENT_LIMIT) unsent = unsent.slice(-UNSENT_LIMIT)
  persistBuffer()
  persistUnsent()
  // Schedule a near-immediate flush so a burst of logs right before the
  // WebView dies still makes it to the server. Debounced so a tight loop
  // doesn't fire one POST per line.
  if (debouncedFlushId) clearTimeout(debouncedFlushId)
  debouncedFlushId = setTimeout(() => {
    debouncedFlushId = null
    flushToServer()
  }, DEBOUNCE_MS)
}

export const logger = {
  log(tag, ...args) {
    appendLine(`[${nowIso()}] [${tag}] ${fmt(args)}`, false)
  },
  error(tag, ...args) {
    appendLine(`[${nowIso()}] [${tag}] ❌ ${fmt(args)}`, true)
  },
  getAll() {
    return buffer.slice()
  },
  clear() {
    buffer = []
    unsent = []
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    try { localStorage.removeItem(UNSENT_KEY) } catch { /* ignore */ }
  },
}

// Best-effort batch flush to the server. Runs on a timer + after every log
// line (debounced ~200ms). Uses fetch(keepalive:true) so the request
// continues even if the WebView is being torn down — critical for capturing
// the last few lines before a crash.
async function flushToServer() {
  if (flushInflight) return
  if (unsent.length === 0) return
  const token = (() => {
    try { return localStorage.getItem('kupot_token') } catch { return null }
  })()
  if (!token) return // not logged in yet — keep buffering

  const toSend = unsent.slice(0, 300)
  flushInflight = true
  try {
    const res = await fetch(`${API_BASE}/client-logs`, {
      method: 'POST',
      keepalive: true,   // request survives WebView teardown / navigation
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lines: toSend,
        device_info: navigator.userAgent,
      }),
    })
    if (res.ok) {
      // Drop only what we actually sent (more lines may have appended meanwhile).
      unsent = unsent.slice(toSend.length)
      persistUnsent()
    }
  } catch {
    // network error — keep the lines, try again on the next tick
  } finally {
    flushInflight = false
  }
}

let flushTimer = null
export function startServerFlush() {
  if (flushTimer) return
  flushTimer = setInterval(flushToServer, FLUSH_INTERVAL_MS)
  // Also try once right away — useful after a restart when unsent has content.
  flushToServer()
}

// Hook global error handlers so uncaught JS errors land in the log too.
let hooked = false
export function installGlobalErrorHandlers() {
  if (hooked) return
  hooked = true
  logger.log('boot', 'app started', navigator.userAgent)
  window.addEventListener('error', (event) => {
    logger.error('window.error',
      event?.message,
      event?.filename + ':' + event?.lineno + ':' + event?.colno,
      event?.error?.stack || '',
    )
  })
  window.addEventListener('unhandledrejection', (event) => {
    const r = event?.reason
    logger.error('unhandled.rejection',
      r?.message || String(r),
      r?.stack || '',
    )
  })
}
