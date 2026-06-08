import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from '@shared/components/ProtectedRoute'
import MobileLayout from './components/MobileLayout'
import BoxesPage from './pages/BoxesPage'
import BoxDetailPage from './pages/BoxDetailPage'
import CollectionPage from './pages/CollectionPage'
import ScanPage from './pages/ScanPage'
import ReportFormPage from './pages/ReportFormPage'
import TasksAlertsPage from './pages/TasksAlertsPage'
import TaskViewPage from './pages/TaskViewPage'
import CashroomAdminPage from './pages/CashroomAdminPage'
import UpdateGate from './components/UpdateGate'
import { useAuth } from '@shared/context/AuthContext'
import { defaultPathForRole } from './utils/defaultPath'

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
  // Maintenance (תחזוקה) has no collection flow — the collection / scan screens
  // don't exist for them. Bounce any deep-link/URL-typing back to the box list.
  if (role === 'maintenance' &&
      (path === '/collection' || path.startsWith('/collection/') || path.startsWith('/scan/'))) {
    return <Navigate to="/boxes" replace />
  }
  return children
}

function App() {
  return (
    <>
      <UpdateGate />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

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
        <Route path="box/:cardId" element={<BoxDetailPage />} />
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
