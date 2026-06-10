import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { AuthProvider } from '@shared/context/AuthContext'
import { LocationProvider } from './context/LocationContext'
import CollectorDataStore from './context/CollectorDataStore'
import LoadingSplash from '@shared/components/LoadingSplash'
import NavigationProgressBar from '@shared/components/NavigationProgressBar'
import { logger, installGlobalErrorHandlers, startServerFlush } from './utils/logger'
import './index.css'
import App from './App.jsx'

// Persistent log: hooks window.error / unhandledrejection and writes every
// line to localStorage. Survives a WebView crash so we can read what the
// scanner did right before it died. The same lines flush to the server
// every few seconds so an admin can read them in a browser without
// touching the device.
installGlobalErrorHandlers()
startServerFlush()

// Expose the logger to shared code (e.g. @shared/api/client.js logs every
// HTTP call via this hook). Decouples shared code from the collector's
// logger implementation.
globalThis.__kupotLog = (tag, ...args) => logger.log(tag, ...args)

// Page lifecycle + connectivity events — useful when an action right before
// a crash coincides with the user backgrounding the app or losing network.
window.addEventListener('online',  () => logger.log('net', 'online'))
window.addEventListener('offline', () => logger.log('net', 'offline'))
document.addEventListener('visibilitychange', () => {
  logger.log('lifecycle', 'visibility →', document.visibilityState)
})
window.addEventListener('pageshow',   (e) => logger.log('lifecycle', 'pageshow persisted=' + !!e.persisted))
window.addEventListener('pagehide',   (e) => logger.log('lifecycle', 'pagehide persisted=' + !!e.persisted))
window.addEventListener('beforeunload', () => logger.log('lifecycle', 'beforeunload'))

// Prevent the WebView from resizing when the keyboard opens — fixes the
// "everything jumps to the top" issue on Android where focused inputs / sticky
// headers were being shoved up. The keyboard now floats over the bottom of the
// page; combined with `windowSoftInputMode="adjustPan"` in AndroidManifest,
// the focused input is panned into view but the rest of the layout stays put.
if (Capacitor.isNativePlatform()) {
  Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {})
  Keyboard.setScroll({ isDisabled: true }).catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <CollectorDataStore>
            <LoadingSplash>
              <NavigationProgressBar />
              <App />
            </LoadingSplash>
          </CollectorDataStore>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
