import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import CardsPage from './pages/CardsPage'
import CardDetailPage from './pages/CardDetailPage'
import BoxesPage from './pages/BoxesPage'
import EnvelopesPage from './pages/EnvelopesPage'
import TasksPage from './pages/TasksPage'
import ReportsPage from './pages/ReportsPage'
import AlertsPage from './pages/AlertsPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import DochotPage from './pages/DochotPage'
import CashroomAdminPage from './pages/CashroomAdminPage'
import PlaceholderPage from './pages/PlaceholderPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — wrapped in app shell */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/cards" replace />} />
          <Route path="/cards"           element={<CardsPage />} />
          <Route path="/cards/:id"       element={<CardDetailPage />} />
          <Route path="/boxes"           element={<BoxesPage />} />
          <Route path="/envelopes"       element={<EnvelopesPage />} />
          <Route path="/tasks"           element={<TasksPage />} />
          <Route path="/reports"         element={<ReportsPage />} />
          <Route path="/alerts"          element={<AlertsPage />} />
          <Route path="/dochot"          element={<DochotPage />} />
          <Route path="/cashroom-admin"  element={<CashroomAdminPage />} />
          <Route path="/users"           element={<UsersPage />} />
          <Route path="/settings"        element={<SettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/cards" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
