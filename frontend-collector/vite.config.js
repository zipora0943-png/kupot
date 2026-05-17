import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))

// Dev server: vite (port 5174) — proxies /api + /uploads to local backend.
// Production: `npm run build && npm run preview` — `preview` listens on 5001
// for all interfaces. The build reads VITE_API_BASE from .env.production so
// the bundled app talks directly to the backend host (no proxy needed).
//
// Aliases:
//   @shared    → frontend-shared/src   (code identical between both frontends)
//   @app-api   → src/api               (per-frontend; lets shared modules import endpoints)
export default defineConfig({
  plugins: [react()],
  define: {
    // Exposed to runtime as import.meta.env.VITE_APP_VERSION (e.g. "1.0.0").
    // Bumped automatically by `npm run release`.
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@shared':  path.resolve(__dirname, '../frontend-shared/src'),
      '@app-api': path.resolve(__dirname, 'src/api'),
    },
    // Force these to resolve to this app's node_modules even when imported
    // from frontend-shared (which has no node_modules of its own).
    dedupe: ['react', 'react-dom', 'react-router-dom', '@vis.gl/react-google-maps'],
  },
  server: {
    port: 5174,
    open: true,
    proxy: {
      '/api':     { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  preview: {
    port: 5001,
    host: '0.0.0.0',
    strictPort: true,
  },
})
