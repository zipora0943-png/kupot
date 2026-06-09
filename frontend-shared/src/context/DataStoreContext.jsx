import React, {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
} from 'react'
import { useAuth } from './AuthContext'
import { api } from '@shared/api/client'
import { connect as connectSocket, disconnect as disconnectSocket } from '@shared/api/socket'

// ===== Data store =====
// Central client-side cache. Each "resource" has:
//   - fetch:  () => Promise<any>            how to (re)load
//   - tables: string[]                      which DB tables invalidate it
//   - label:  string  (optional)            Hebrew label for the splash screen
//
// Lifecycle:
//   1. After login → GET /api/initial-load (lookups + settings + users)
//   2. In parallel → run every resource's `fetch()`
//   3. Open a Socket.IO connection. Every `entity.changed` event invalidates
//      the resources whose `tables` include the changed table, and a debounced
//      refetch fires per resource.
//   4. On reconnect (we may have missed events) → refetch everything.
//
// Pages read via `useData(name)`. The data is the latest snapshot. While the
// store is hydrating for the first time, `ready` is false. The splash screen
// reads `useDataStoreProgress()` for a live load bar.

const DataStoreContext = createContext(null)

// How long to wait after the last invalidation before actually refetching.
// Batches rapid bursts of NOTIFYs (e.g. a bulk import emits one event per row).
const REFETCH_DEBOUNCE_MS = 200

// Sentinel name used in `status` for the bootstrap (/api/initial-load) call —
// the progress bar counts it together with the per-resource fetches.
const BOOTSTRAP_KEY = '__bootstrap__'
const BOOTSTRAP_LABEL = 'נתוני בסיס'

export function DataStoreProvider({ resources = {}, children }) {
  const { token, user, isAuthenticated } = useAuth()
  const role = user?.role

  // Restrict the active resource set to what the current role may actually
  // fetch. A resource with no `roles` list is available to every authenticated
  // role; otherwise the role must be listed. Without this the store would fire
  // requests the backend rejects with 403 — e.g. a cashroom user has no access
  // to cards/tasks/reports, a collector none to the cashroom-only slices.
  const resourcesForRole = useMemo(() => {
    const out = {}
    for (const [name, def] of Object.entries(resources)) {
      if (!Array.isArray(def.roles) || (role && def.roles.includes(role))) {
        out[name] = def
      }
    }
    return out
  }, [resources, role])

  // Snapshot of every resource by name. `null` means "not loaded yet".
  const [store, setStore]   = useState(() => emptyStoreFor(resourcesForRole))
  // Initial-load payload (lookups, settings, users). One blob from /api/initial-load.
  const [bootstrap, setBootstrap] = useState(null)
  const [ready, setReady]   = useState(false)
  const [error, setError]   = useState(null)
  // Per-key load status: 'pending' | 'loaded' | 'error'. Includes BOOTSTRAP_KEY.
  const [status, setStatus] = useState(() => initialStatus(resourcesForRole))

  // Per-resource debounce timers (kept in a ref so changing them doesn't re-render).
  const timers = useRef({})

  // Stable accessor for each resource's fetch fn. We rebuild this whenever the
  // role-scoped resource set changes (the raw `resources` should be memoized).
  const fetchersRef = useRef(resourcesForRole)
  useEffect(() => { fetchersRef.current = resourcesForRole }, [resourcesForRole])

  // ---- single-resource refetch ----
  const refetchOne = useCallback(async (name, { trackStatus = false } = {}) => {
    const def = fetchersRef.current[name]
    if (!def?.fetch) return
    if (trackStatus) setStatus((s) => ({ ...s, [name]: 'pending' }))
    try {
      const data = await def.fetch()
      setStore((prev) => ({ ...prev, [name]: data }))
      if (trackStatus) setStatus((s) => ({ ...s, [name]: 'loaded' }))
    } catch (err) {
      console.warn(`[dataStore] refetch '${name}' failed:`, err.message)
      if (trackStatus) setStatus((s) => ({ ...s, [name]: 'error' }))
    }
  }, [])

  const refetchOneDebounced = useCallback((name) => {
    clearTimeout(timers.current[name])
    timers.current[name] = setTimeout(() => refetchOne(name), REFETCH_DEBOUNCE_MS)
  }, [refetchOne])

  // ---- full refetch (login, reconnect) ----
  // `tracked=true` updates per-resource status as each fetch settles, so the
  // splash progress bar can fill in real time.
  const refetchAll = useCallback(async ({ tracked = false } = {}) => {
    const names = Object.keys(fetchersRef.current)
    await Promise.all(names.map((n) => refetchOne(n, { trackStatus: tracked })))
  }, [refetchOne])

  // ---- initial hydration after login ----
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setReady(false)
      setBootstrap(null)
      setStore(emptyStoreFor(fetchersRef.current))
      setStatus(initialStatus(fetchersRef.current))
      return
    }

    let cancelled = false
    setReady(false)
    setError(null)
    setStatus(initialStatus(fetchersRef.current))

    async function hydrate() {
      try {
        const bootPromise = api.get('/initial-load')
          .then((boot) => {
            if (cancelled) return null
            setBootstrap(boot)
            setStatus((s) => ({ ...s, [BOOTSTRAP_KEY]: 'loaded' }))
            return boot
          })
          .catch((err) => {
            if (cancelled) return null
            console.warn('[dataStore] /initial-load failed:', err.message)
            setStatus((s) => ({ ...s, [BOOTSTRAP_KEY]: 'error' }))
            return null
          })

        await Promise.all([bootPromise, refetchAll({ tracked: true })])
        if (cancelled) return
        setReady(true)
      } catch (err) {
        if (cancelled) return
        setError(err)
        setReady(true) // surface the failure rather than spin forever
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [isAuthenticated, token, refetchAll])

  // ---- socket lifecycle ----
  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket()
      return
    }
    const socket = connectSocket(token)
    if (!socket) return

    function handleEntityChanged({ table }) {
      if (!table) return
      const names = Object.entries(fetchersRef.current)
        .filter(([, def]) => Array.isArray(def.tables) && def.tables.includes(table))
        .map(([name]) => name)
      names.forEach(refetchOneDebounced)
    }

    function handleReconnect() {
      // We may have missed events while disconnected — refresh everything.
      refetchAll()
    }

    socket.on('entity.changed', handleEntityChanged)
    socket.io.on('reconnect', handleReconnect)

    return () => {
      socket.off('entity.changed', handleEntityChanged)
      socket.io.off('reconnect', handleReconnect)
    }
  }, [isAuthenticated, token, refetchAll, refetchOneDebounced])

  // ---- cleanup pending timers on unmount ----
  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout)
  }, [])

  // ---- progress derived from status ----
  // Stable array of {name, label, status} so the splash can list each item.
  const progress = useMemo(() => {
    const items = [
      { name: BOOTSTRAP_KEY, label: BOOTSTRAP_LABEL, status: status[BOOTSTRAP_KEY] || 'pending' },
      ...Object.entries(resourcesForRole).map(([name, def]) => ({
        name,
        label: def.label || name,
        status: status[name] || 'pending',
      })),
    ]
    const total  = items.length
    const loaded = items.filter((i) => i.status === 'loaded' || i.status === 'error').length
    return { items, total, loaded }
  }, [resourcesForRole, status])

  const value = useMemo(() => ({
    store,
    bootstrap,
    ready,
    error,
    progress,
    refetch: refetchOne,
    refetchAll,
    user,
  }), [store, bootstrap, ready, error, progress, refetchOne, refetchAll, user])

  return (
    <DataStoreContext.Provider value={value}>
      {children}
    </DataStoreContext.Provider>
  )
}

function emptyStoreFor(resources) {
  const out = {}
  for (const k of Object.keys(resources)) out[k] = null
  return out
}

function initialStatus(resources) {
  const out = { [BOOTSTRAP_KEY]: 'pending' }
  for (const k of Object.keys(resources)) out[k] = 'pending'
  return out
}

/**
 * Read one resource from the store. Returns `null` while the initial fetch is
 * still in flight; replaces with the data after that. Call `refetch()` to
 * force a fresh load (rarely needed — sockets keep it current).
 */
export function useData(name) {
  const ctx = useContext(DataStoreContext)
  if (!ctx) throw new Error('useData must be used inside <DataStoreProvider>')
  const value = ctx.store[name]
  const refetch = useCallback(() => ctx.refetch(name), [ctx, name])
  return { data: value, loading: value === null && !ctx.ready, refetch }
}

/**
 * Read the bootstrap payload (lookups, settings, users) loaded once per login.
 * Returns null until the initial-load call completes.
 */
export function useBootstrap() {
  const ctx = useContext(DataStoreContext)
  if (!ctx) throw new Error('useBootstrap must be used inside <DataStoreProvider>')
  return ctx.bootstrap
}

/**
 * `ready` flips to true once the bootstrap call + every initial resource fetch
 * has settled (success or failure). Use it to gate splash screens.
 */
export function useDataStoreReady() {
  const ctx = useContext(DataStoreContext)
  if (!ctx) throw new Error('useDataStoreReady must be used inside <DataStoreProvider>')
  return ctx.ready
}

/**
 * Live progress of the initial hydration — used by LoadingSplash. Returns
 *   { items: [{name, label, status: 'pending'|'loaded'|'error'}], total, loaded }
 * `items` is stable in order and includes the bootstrap entry first.
 */
export function useDataStoreProgress() {
  const ctx = useContext(DataStoreContext)
  if (!ctx) throw new Error('useDataStoreProgress must be used inside <DataStoreProvider>')
  return ctx.progress
}
