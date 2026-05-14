require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Security headers
app.use(helmet());

// ── CORS — comma-separated list in CORS_ORIGIN, or '*' to allow all (demo only)
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(s => s.trim()),
}));

// ── Body parser with explicit size limit
app.use(express.json({ limit: process.env.MAX_JSON_BODY || '1mb' }));

// ── Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Rate-limit login: 10 requests per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

// ── Static serving of uploaded images
const path = require('path');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false }));

// ── Static serving of public downloads (APK builds, version manifest)
//    Public — no auth required so devices can pull the APK directly.
const PUBLIC_DIR = path.resolve(__dirname, '../public');
app.use('/downloads', express.static(path.join(PUBLIC_DIR, 'downloads'), {
  fallthrough: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.apk')) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    }
  },
}));

// ── Routes
app.use('/api/auth/login',     loginLimiter); // applies before the auth router below
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/boxes',          require('./routes/boxes'));
app.use('/api/cards',          require('./routes/cards'));
app.use('/api/envelopes',      require('./routes/envelopes'));
app.use('/api/events',         require('./routes/events'));
app.use('/api/tasks',          require('./routes/tasks'));
app.use('/api/reports',        require('./routes/reports'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/alerts',         require('./routes/alerts'));
app.use('/api/reports-export', require('./routes/reportsExport'));
app.use('/api/settings',       require('./routes/settings'));
app.use('/api/uploads',        require('./routes/uploads'));
app.use('/api/version',        require('./routes/version'));
app.use('/api/location-overrides', require('./routes/locationOverrides'));

// ── Health check
app.get('/health', async (_req, res) => {
  try {
    const pool = require('./db/pool');
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, db: false });
  }
});

// ── 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Centralized error handler
// In development, returns the actual message to help debugging.
// In production, returns a generic message.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(err.status || 500).json({
    error: isDev ? (err.message || 'Internal server error') : 'Internal server error',
  });
});

// ── Process-level safety nets
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;

// Only listen when this file is the entry point (so tests can import `app`
// without spawning a real server).
if (require.main === module) {
  app.listen(PORT, () => console.log(`Kupot backend listening on port ${PORT}`));
}

module.exports = app;
