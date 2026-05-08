// PM2 ecosystem — runs the backend + both frontend preview servers.
//
// Usage on the server (after `npm run build` in each frontend):
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup            # then run the printed command to enable on boot
//
// All three apps log to ~/.pm2/logs by default. Tail with:
//   pm2 logs kupot-backend
//   pm2 logs kupot-admin
//   pm2 logs kupot-collector

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
    {
      name: 'kupot-admin',
      cwd: './frontend-admin',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host 0.0.0.0 --port 5000 --strictPort',
      max_memory_restart: '300M',
      autorestart: true,
    },
    {
      name: 'kupot-collector',
      cwd: './frontend-collector',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host 0.0.0.0 --port 5001 --strictPort',
      max_memory_restart: '300M',
      autorestart: true,
    },
  ],
};
