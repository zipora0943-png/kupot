// PM2 ecosystem — runs the backend only.
// Both frontends are built (`npm run build`) and served as static files by
// nginx directly from their `dist/` directories — no vite preview processes
// in production anymore (the old kupot-admin / kupot-collector entries were
// removed when the admin moved behind nginx at /admin/).
//
// Logs:
//   pm2 logs kupot-backend
//
// Usage on the server:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup            # then run the printed command to enable on boot

module.exports = {
  apps: [
    {
      name: 'kupot-backend',
      cwd: './backend',
      script: 'src/index.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      autorestart: true,
    },
  ],
};
