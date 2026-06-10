import React, { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from '@shared/components/ProtectedRoute'
import MobileLayout from './components/MobileLayout'
import BoxesPage from './pages/BoxesPage'
import CollectionPage from './pages/CollectionPage'
import ScanPage from './pages/ScanPage'
import ReportFormPage from './pages/ReportFormPage'
import TasksAlertsPage from './pages/TasksAlertsPage'
import TaskViewPage from './pages/TaskViewPage'
import CashroomAdminPage from './pages/CashroomAdminPage'
import LogsPage from './pages/LogsPage'
import UpdateGate from './components/UpdateGate'
import AppNotifications from './components/AppNotifications'
import { useAuth } from '@shared/context/AuthContext'
import { defaultPathForRole } from './utils/defaultPath'
import { logger } from './utils/logger'

// Tap every navigation so the log shows the exact route just before any
// crash — invaluable for reproducing crashes from the field.
function NavLogger() {
  const location = useLocation()
  const prev = useRef(null)
  useEffect(() => {
    const cur = location.pathname + location.search
    logger.log('nav', (prev.current ? `${prev.current} → ` : '') + cur)
    prev.current = cur
  }, [location])
  return null
}

// Cashroom users are locked to /cashroom-admin (their only screen). Non-cashroom
// users hitting /cashroom-admin are bounced back to their default landing — the
// page is invisible to them. Both directions are enforced at the route level so
// URL typing, deep-links, and post-reload restores all behave the same way.
function RoleGuard({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const role = user?.role
  const path = location.pathname
  const onCashroomScreen = path === '/cashroom-admin'

  if (role === 'cashroom' && !onCashroomScreen) {
    return <Navigate to="/cashroom-admin" replace />
  }
  if (role && role !== 'cashroom' && onCashroomScreen) {
    return <Navigate to={defaultPathForRole(role)} replace />
  }
  return children
}

function App() {
  return (
    <>
      <UpdateGate />
      <AppNotifications />
      <NavLogger />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

      {/* Admin debug log viewer — accessible without the MobileLayout chrome so
          it works from any auth state and any device size. The page itself
          gates by user.role. */}
      <Route
        path="/logs"
        element={
          <ProtectedRoute>
            <LogsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/scan/:cardId"
        element={
          <ProtectedRoute>
            <RoleGuard>
              <ScanPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleGuard>
              <MobileLayout />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/boxes" replace />} />
        <Route path="boxes" element={<BoxesPage />} />
        <Route path="collection" element={<CollectionPage />} />
        <Route path="collection/:cardId" element={<CollectionPage />} />
        <Route path="report/:cardId" element={<ReportFormPage />} />
        <Route path="tasks-alerts" element={<TasksAlertsPage />} />
        <Route path="task/:taskId" element={<TaskViewPage />} />
        <Route path="cashroom-admin" element={<CashroomAdminPage />} />
      </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
