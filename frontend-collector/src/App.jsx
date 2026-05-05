import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import MobileLayout from './components/MobileLayout'
import BoxesPage from './pages/BoxesPage'
import CollectionPage from './pages/CollectionPage'
import ScanPage from './pages/ScanPage'

function Placeholder({ title }) {
  return <div>{title}</div>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/scan/:cardId"
        element={
          <ProtectedRoute>
            <ScanPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MobileLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/boxes" replace />} />
        <Route path="boxes" element={<BoxesPage />} />
        <Route path="collection" element={<CollectionPage />} />
        <Route path="collection/:cardId" element={<CollectionPage />} />
        <Route path="tasks-alerts" element={<Placeholder title="משימות והתראות" />} />
        <Route path="task/:taskId" element={<Placeholder title="משימה" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
