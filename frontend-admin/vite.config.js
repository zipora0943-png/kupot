import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server: vite (port 5173) — proxies /api + /uploads to local backend.
// Production: `npm run build && npm run preview` — `preview` listens on 5000
// for all interfaces. The build reads VITE_API_BASE from .env.production so
// the bundled app talks directly to the backend host (no proxy needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api':     { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  preview: {
    port: 5000,
    host: '0.0.0.0',
    strictPort: true,
  },
})
