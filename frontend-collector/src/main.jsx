import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@shared/context/AuthContext'
import CollectorDataStore from './context/CollectorDataStore'
import LoadingSplash from '@shared/components/LoadingSplash'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CollectorDataStore>
          <LoadingSplash>
            <App />
          </LoadingSplash>
        </CollectorDataStore>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
