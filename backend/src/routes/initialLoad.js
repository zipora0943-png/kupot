// ===== GET /api/initial-load =====
// Returns the small, frequently-used reference data the UI needs immediately
// after login, in one HTTP round-trip. The big lists (cards, boxes, tasks,
// envelopes, reports) stay on their existing endpoints — the client-side data
// store pre-fetches those in parallel and then keeps them fresh via Socket.IO
// `entity.changed` events.
//
// Scoping by role:
//   - admin / cashroom: full lookups + settings + users (UI shows user names)
//   - collector:        same lookups + settings (no users list)
//
// The endpoint is intentionally small (a few KB) so it doesn't replace the
// per-resource endpoints, just front-loads the things every screen needs.

const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { role } = req.user;

    const queries = {
      task_types: pool.query(
        `SELECT id, name, icon, opens_card, closes_card, grants_temporary_access
           FROM task_types ORDER BY id`,
      ),
      report_types: pool.query(
        `SELECT id, name, icon FROM report_types ORDER BY id`,
      ),
      box_types: pool.query(
        `SELECT id, name, kind FROM box_types ORDER BY id`,
      ),
      cities: pool.query(
        `SELECT id, name, district FROM cities ORDER BY name`,
      ),
      districts: pool.query(
        `SELECT DISTINCT district AS name
           FROM cities WHERE district IS NOT NULL AND district <> ''
           ORDER BY 1`,
      ),
      settings: pool.query(`SELECT key, value FROM settings`),
    };

    // Admin and cashroom UIs render user names everywhere (audit columns,
    // collector picker, etc.) — fetch the user list for them. Collectors
    // shouldn't see the full user directory.
    if (role === 'admin' || role === 'cashroom') {
      queries.users = pool.query(
        `SELECT id, name, username, role, active
           FROM users ORDER BY name`,
      );
    }

    const entries = await Promise.all(
      Object.entries(queries).map(async ([key, p]) => [key, (await p).rows]),
    );
    const out = Object.fromEntries(entries);

    // Reshape settings into a key/value object so callers can read by name.
    out.settings = (out.settings || []).reduce((acc, r) => {
      acc[r.key] = r.value;
      return acc;
    }, {});

    // Reshape districts into a string[] (the rows are {name} objects).
    out.districts = (out.districts || []).map((r) => r.name);

    res.json({
      role,
      user: { id: req.user.id, role: req.user.role },
      ...out,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
