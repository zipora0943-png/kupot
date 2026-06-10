// ===== Client-side log collector =====
// Lets the collector APK (and any other authenticated client) ship log lines
// up to the server so an admin can read them from a browser even after the
// device's WebView crashed and lost in-memory state.
//
// Storage: in-memory ring buffer. Survives until backend restart, which is
// fine for live debugging. No DB schema, no migrations.
//
// POST /api/client-logs       — any authenticated user appends a batch
// GET  /api/client-logs       — admin reads recent entries (?since=ISO optional)
// DELETE /api/client-logs     — admin clears the buffer

const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');

router.use(authenticate);

const MAX_ENTRIES        = 1000;   // total batches stored
const MAX_LINES_PER_POST = 500;    // per request cap

const entries = []; // [{ received_at, user_id, username, role, device_info, lines: [] }]

function push(entry) {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

// POST /api/client-logs
//   body: { lines: string[], device_info?: string }
router.post('/', async (req, res, next) => {
  try {
    const { lines, device_info } = req.body || {};
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'lines must be a non-empty array' });
    }
    // Resolve username for nicer display in the viewer; non-fatal if it fails.
    let username = null;
    try {
      const r = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
      username = r.rows[0]?.username || null;
    } catch { /* ignore */ }

    const capped = lines
      .slice(0, MAX_LINES_PER_POST)
      .map((l) => (typeof l === 'string' ? l : String(l)));

    push({
      received_at: new Date().toISOString(),
      user_id:  req.user.id,
      username,
      role:     req.user.role,
      device_info: typeof device_info === 'string' ? device_info.slice(0, 400) : null,
      lines: capped,
    });

    res.json({ ok: true, stored: capped.length, total_entries: entries.length });
  } catch (err) { next(err); }
});

// GET /api/client-logs  (admin)
//   query: ?since=<ISO>  →  return only entries received after that time
//          ?user_id=<n>  →  filter by user
router.get('/', requireRole('admin'), (req, res) => {
  let since = 0;
  if (req.query.since) {
    const t = Date.parse(req.query.since);
    if (Number.isFinite(t)) since = t;
  }
  const wantedUser = req.query.user_id ? Number(req.query.user_id) : null;

  const filtered = entries.filter((e) => {
    if (since && Date.parse(e.received_at) <= since) return false;
    if (wantedUser != null && e.user_id !== wantedUser) return false;
    return true;
  });

  res.json({ entries: filtered, total: entries.length });
});

// DELETE /api/client-logs  (admin)
router.delete('/', requireRole('admin'), (_req, res) => {
  const n = entries.length;
  entries.length = 0;
  res.json({ ok: true, cleared: n });
});

module.exports = router;
