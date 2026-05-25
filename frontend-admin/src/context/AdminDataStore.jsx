import React, { useMemo } from 'react'
import { DataStoreProvider } from '@shared/context/DataStoreContext'
import {
  cards, boxes, envelopes, tasks, reports, users, alerts,
} from '../api/endpoints'

// Resource registry for the admin panel. Each entry tells the store:
//   - fetch  : how to (re)load this slice
//   - tables : which backend tables, when changed, invalidate this slice
//              (the names match PostgreSQL table names emitted by NOTIFY)
function buildResources() {
  return {
    cards: {
      label: 'כרטסות',
      fetch:  () => cards.getAll(),
      // Card listings include resolved collector names + status derived from
      // events, so changes to either should refresh the list.
      tables: ['cards', 'events', 'users', 'boxes'],
    },
    boxes: {
      label: 'קופות',
      fetch:  () => boxes.getAll(),
      tables: ['boxes', 'box_types'],
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
    },
    reports: {
      label: 'דיווחים',
      fetch:  () => reports.getAll(),
      tables: ['reports', 'report_types', 'users', 'cards'],
    },
    alertsNoCollection: {
      label: 'התראות',
      fetch:  () => alerts.noCollection(),
      // Threshold lives in settings; collection state lives in events.
      tables: ['cards', 'events', 'settings'],
    },
    pendingEnvelopes: {
      label: 'מעטפות ממתינות',
      fetch:  () => envelopes.getPending(),
      tables: ['envelopes'],
    },
    // Full user list is also part of /api/initial-load.bootstrap.users but
    // we register it here so socket-driven user changes (rename, deactivate)
    // refresh the data immediately without a manual reload.
    users: {
      label: 'משתמשים',
      fetch:  () => users.getAll(),
      tables: ['users'],
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
