// ===== Socket.IO client =====
// Wraps socket.io-client with: derived URL (from VITE_API_BASE), token-based
// auth, single global instance, and a small subscribe API.
//
// The backend places each client into a `role:<role>` room (see backend
// services/socket.js). All entity events arrive as `entity.changed` with
// payload { table, op, id }. Consumers subscribe via `on(event, handler)`.

import { io } from 'socket.io-client'
import { API_BASE } from './client'

// Derive the socket server URL from API_BASE:
//   '/api'                          → undefined  (relative — Vite proxies in dev)
//   'http://host:port/api'          → 'http://host:port'
function deriveSocketUrl() {
  if (!API_BASE || API_BASE.startsWith('/')) return undefined
  return API_BASE.replace(/\/api\/?$/, '')
}

let socket = null

/**
 * Open (or return existing) socket. Re-connects automatically on token change.
 */
export function connect(token) {
  if (socket && socket.auth?.token === token) return socket
  if (socket) {
    socket.disconnect()
    socket = null
  }
  if (!token) return null

  const url = deriveSocketUrl()
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
  })
  return socket
}

export function disconnect() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket() {
  return socket
}
