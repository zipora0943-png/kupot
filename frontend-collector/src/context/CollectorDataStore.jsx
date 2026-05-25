import React, { useMemo } from 'react'
import { DataStoreProvider } from '@shared/context/DataStoreContext'
import { cards, tasks, envelopes, reports, alerts } from '../api/endpoints'

// Resource registry for the collector app. Scope is narrower than admin —
// /api/cards already filters to boxes visible to this collector, same for
// /api/tasks (assigned/area), etc., so we can call the same endpoints and
// rely on backend filtering.
function buildResources() {
  return {
    cards: {
      label: 'כרטסות',
      fetch:  () => cards.getAll(),
      tables: ['cards', 'events', 'boxes'],
    },
    tasks: {
      label: 'משימות',
      fetch:  () => tasks.getAll(),
      tables: ['tasks', 'task_types', 'cards'],
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
    },
    alertsNoCollection: {
      label: 'התראות',
      fetch:  () => alerts.noCollection(),
      // Threshold lives in settings; collection state derives from events.
      tables: ['cards', 'events', 'settings'],
    },
    // Cashroom-only slices. Non-cashroom roles get a 403 here, which the
    // store catches silently — wasteful but harmless. The cashroom screen
    // is the only consumer.
    pendingEnvelopes: {
      label: 'מעטפות ממתינות',
      fetch:  () => envelopes.getPending(),
      tables: ['envelopes'],
    },
    recentEnteredEnvelopes: {
      label: 'מעטפות אחרונות',
      fetch:  () => envelopes.getRecentEntered(20),
      tables: ['envelopes'],
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
