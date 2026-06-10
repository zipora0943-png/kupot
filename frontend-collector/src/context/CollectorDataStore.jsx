import React, { useMemo } from 'react'
import { DataStoreProvider } from '@shared/context/DataStoreContext'
import {
  cards, tasks, envelopes, reports, alerts,
  taskTypes, reportTypes, boxTypes,
} from '../api/endpoints'

// Resource registry for the collector app. Scope is narrower than admin —
// /api/cards already filters to boxes visible to this collector, same for
// /api/tasks (assigned/area), etc., so we can call the same endpoints and
// rely on backend filtering.
//
// `roles` mirrors the backend requireRole() gating (omitted = every role).
// The store skips the rest, so a collector no longer fires the cashroom-only
// slices, and a maintenance user no longer fires alerts — both used to return
// a silently-swallowed 403.
function buildResources() {
  return {
    cards: {
      label: 'כרטסות',
      fetch:  () => cards.getAll(),
      tables: ['cards', 'events', 'boxes'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    tasks: {
      label: 'משימות',
      fetch:  () => tasks.getAll(),
      tables: ['tasks', 'task_types', 'cards'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    envelopes: {
      label: 'מעטפות',
      fetch:  () => envelopes.getAll(),
      tables: ['envelopes'],
    },
    reports: {
      label: 'דיווחים',
      fetch:  () => reports.getAll(),
      tables: ['reports', 'report_types'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    alertsNoCollection: {
      label: 'התראות',
      fetch:  () => alerts.noCollection(),
      // Threshold lives in settings; collection state derives from events.
      tables: ['cards', 'events', 'settings'],
      roles:  ['admin', 'collector'],
    },
    // Admin-managed lookup tables. Kept in the store (instead of fetched
    // per-modal) so that when the admin adds a new task/report/box type
    // the dropdowns refresh automatically via the entity.changed socket
    // event — collector doesn't need to restart the app.
    taskTypes: {
      label: 'סוגי משימות',
      fetch:  () => taskTypes.getAll(),
      tables: ['task_types'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    reportTypes: {
      label: 'סוגי דיווחים',
      fetch:  () => reportTypes.getAll(),
      tables: ['report_types'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    boxTypes: {
      label: 'סוגי קופות',
      fetch:  () => boxTypes.getAll(),
      tables: ['box_types'],
      roles:  ['admin', 'collector', 'maintenance'],
    },
    // Cashroom-only slices. Tagged so non-cashroom roles skip them entirely
    // instead of firing a request the backend answers with 403.
    pendingEnvelopes: {
      label: 'מעטפות ממתינות',
      fetch:  () => envelopes.getPending(),
      tables: ['envelopes'],
      roles:  ['admin', 'cashroom'],
    },
    recentEnteredEnvelopes: {
      label: 'מעטפות אחרונות',
      fetch:  () => envelopes.getRecentEntered(20),
      tables: ['envelopes'],
      roles:  ['admin', 'cashroom'],
    },
  }
}

export default function CollectorDataStore({ children }) {
  const resources = useMemo(buildResources, [])
  return (
    <DataStoreProvider resources={resources}>
      {children}
    </DataStoreProvider>
  )
}
