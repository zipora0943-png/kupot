import React, { useMemo } from 'react'
import { DataStoreProvider } from '@shared/context/DataStoreContext'
import {
  cards, boxes, envelopes, tasks, reports, users, alerts,
} from '../api/endpoints'

// Resource registry for the admin panel. Each entry tells the store:
//   - fetch  : how to (re)load this slice
//   - tables : which backend tables, when changed, invalidate this slice
//              (the names match PostgreSQL table names emitted by NOTIFY)
//   - roles  : which roles may fetch it (omitted = every authenticated role).
//              Mirrors the backend requireRole() gating so the store never
//              fires a request the server would reject with 403 — e.g. a
//              cashroom user has no access to cards/tasks/reports/users.
function buildResources() {
  return {
    cards: {
      label: 'כרטסות',
      fetch:  () => cards.getAll(),
      // Card listings include resolved collector names + status derived from
      // events, so changes to either should refresh the list.
      tables: ['cards', 'events', 'users', 'boxes'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    boxes: {
      label: 'קופות',
      fetch:  () => boxes.getAll(),
      tables: ['boxes', 'box_types'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    envelopes: {
      label: 'מעטפות',
      fetch:  () => envelopes.getAll(),
      tables: ['envelopes'],
    },
    tasks: {
      label: 'משימות',
      fetch:  () => tasks.getAll(),
      tables: ['tasks', 'task_types', 'users', 'cards'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    reports: {
      label: 'דיווחים',
      fetch:  () => reports.getAll(),
      tables: ['reports', 'report_types', 'users', 'cards'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    alertsNoCollection: {
      label: 'התראות',
      fetch:  () => alerts.noCollection(),
      // Threshold lives in settings; collection state lives in events.
      tables: ['cards', 'events', 'settings'],
      roles:  ['admin', 'collector'],
    },
    pendingEnvelopes: {
      label: 'מעטפות ממתינות',
      fetch:  () => envelopes.getPending(),
      tables: ['envelopes'],
      roles:  ['admin', 'cashroom'],
    },
    // Cashroom recent-entered list + today's totals. Registered here so the
    // shared cashroom page reads them via useData and they refresh live over
    // the socket — the same slices the collector already uses.
    recentEnteredEnvelopes: {
      label: 'מעטפות אחרונות',
      fetch:  () => envelopes.getRecentEntered(20),
      tables: ['envelopes'],
      roles:  ['admin', 'cashroom'],
    },
    cashroomTodayTotal: {
      label: 'סיכום היום',
      fetch:  () => envelopes.todayTotal(),
      tables: ['envelopes'],
      roles:  ['admin', 'cashroom'],
    },
    // Full user list is also part of /api/initial-load.bootstrap.users but
    // we register it here so socket-driven user changes (rename, deactivate)
    // refresh the data immediately without a manual reload.
    users: {
      label: 'משתמשים',
      fetch:  () => users.getAll(),
      tables: ['users'],
      roles:  ['admin'],
    },
  }
}

export default function AdminDataStore({ children }) {
  const resources = useMemo(buildResources, [])
  return (
    <DataStoreProvider resources={resources}>
      {children}
    </DataStoreProvider>
  )
}
