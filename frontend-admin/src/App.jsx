import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@shared/context/AuthContext'
import ProtectedRoute from '@shared/components/ProtectedRoute'
import AdminDataStore from './context/AdminDataStore'
import LoadingSplash from '@shared/components/LoadingSplash'
import NavigationProgressBar from '@shared/components/NavigationProgressBar'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import CardDetailPage from './pages/CardDetailPage'
import { defaultPathForRole } from './utils/defaultPath'

// Task 36: cashroom users land on the cashroom view; everyone else → /cards.
function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={defaultPathForRole(user?.role)} replace />
}

// Task 36: cashroom users are locked to /cashroom-admin. Any other URL — typed
// directly, deep-linked, or reached after a page reload — bounces them back.
function CashroomLockGuard({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user?.role === 'cashroom' && location.pathname !== '/cashroom-admin') {
    return <Navigate to="/cashroom-admin" replace />
  }
  return children
}

// All sidebar screens (CardsPage, BoxesPage, …, SettingsPage) are mounted via
// <KeepAliveScreens /> inside Layout so their state survives navigation.
// Routes here only cover fresh-mount cases: index redirect, /cards/:id, and the
// catch-all redirect for stray URLs.
function App() {
  return (
    <AuthProvider>
      <AdminDataStore>
        <LoadingSplash>
          <NavigationProgressBar />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected — wrapped in app shell */}
            <Route
              element={
                <ProtectedRoute>
                  <CashroomLockGuard>
                    <Layout />
                  </CashroomLockGuard>
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeRedirect />} />
              <Route path="/cards/:id" element={<CardDetailPage />} />
              {/* Sidebar screens are matched inside Layout via KeepAliveScreens. */}
              <Route path="*" element={null} />
            </Route>
          </Routes>
        </LoadingSplash>
      </AdminDataStore>
    </AuthProvider>
  )
}

export default App
