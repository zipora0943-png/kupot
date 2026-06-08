const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');

router.use(authenticate);
// Task 36: cashroom users have no access to settings — only the cashroom workflow.
// Maintenance (תחזוקה) needs read access to lookup types + maps key (mutations
// stay admin-only via per-route requireRole below).
router.use(requireRole('admin', 'collector', 'maintenance'));

// ─── Whitelist of allowed setting keys + their type validators.
// Adding a new setting requires updating this map.
const SETTINGS_SCHEMA = {
  alert_days_global: {
    type: 'integer',
    min: 1,
    max: 3650,
    default: '30',
  },
  // Task 62: Google Maps Geocoding API key. Stored only in the settings table
  // (no .env fallback). Read by backend/src/services/geocoding.js at request
  // time. Empty string disables geocoding.
  google_maps_api_key: {
    type: 'string',
    allowEmpty: true,
    default: '',
    sensitive: true, // GET masks the value
  },
};

function coerceAndValidate(key, rawValue) {
  const schema = SETTINGS_SCHEMA[key];
  if (!schema) return { error: `Unknown setting: ${key}` };

  if (schema.type === 'integer') {
    const n = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(n)) return { error: `${key} must be an integer` };
    if (schema.min !== undefined && n < schema.min) return { error: `${key} must be >= ${schema.min}` };
    if (schema.max !== undefined && n > schema.max) return { error: `${key} must be <= ${schema.max}` };
    return { value: String(n) };
  }
  if (schema.type === 'string') {
    if (typeof rawValue !== 'string') return { error: `${key} must be a string` };
    if (!schema.allowEmpty && !rawValue.trim()) return { error: `${key} required` };
    return { value: rawValue };
  }
  if (schema.type === 'boolean') {
    if (rawValue === true || rawValue === 'true')  return { value: 'true' };
    if (rawValue === false || rawValue === 'false') return { value: 'false' };
    return { error: `${key} must be a boolean` };
  }
  return { error: `Unsupported type for ${key}` };
}

// ─── lookup tables ────────────────────────────────────────────────
// Read-only listings of the type tables; needed by every UI that has
// "task type" / "report type" / "box type" dropdowns.

// GET /api/settings/task-types
router.get('/task-types', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, icon, opens_card, closes_card, grants_temporary_access
         FROM task_types ORDER BY id`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/settings/report-types
router.get('/report-types', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, icon FROM report_types ORDER BY id`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/settings/box-types
router.get('/box-types', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, kind FROM box_types ORDER BY id`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── type CRUD (admin only) ────────────────────────────────────────
// All three resources follow the same pattern: insert / partial-update /
// delete. Deletes return 409 when the row is referenced by an active record
// (task_types are referenced by tasks; same idea for the other two).

function badRequest(res, msg) { return res.status(400).json({ error: msg }); }

function validateString(v, label, { allowEmpty = false } = {}) {
  if (typeof v !== 'string') return `${label} must be a string`;
  if (!allowEmpty && !v.trim()) return `${label} required`;
  return null;
}

// ── TASK TYPES ────────────────────────────────────────────────────
router.post('/task-types', requireRole('admin'), async (req, res, next) => {
  const { name, icon, opens_card, closes_card, grants_temporary_access } = req.body || {};
  const e = validateString(name, 'name');
  if (e) return badRequest(res, e);
  if (icon !== undefined && icon !== null && typeof icon !== 'string')
    return badRequest(res, 'icon must be string or null');
  if (opens_card !== undefined && typeof opens_card !== 'boolean')
    return badRequest(res, 'opens_card must be boolean');
  if (closes_card !== undefined && typeof closes_card !== 'boolean')
    return badRequest(res, 'closes_card must be boolean');
  if (grants_temporary_access !== undefined && typeof grants_temporary_access !== 'boolean')
    return badRequest(res, 'grants_temporary_access must be boolean');

  try {
    const { rows } = await pool.query(
      `INSERT INTO task_types (name, icon, opens_card, closes_card, grants_temporary_access)
       VALUES ($1, $2, COALESCE($3, FALSE), COALESCE($4, FALSE), COALESCE($5, FALSE))
       RETURNING id, name, icon, opens_card, closes_card, grants_temporary_access`,
      [name.trim(), icon || null, opens_card, closes_card, grants_temporary_access]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'task type with this name already exists' });
    next(err);
  }
});

router.put('/task-types/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid id');

  const { name, icon, opens_card, closes_card, grants_temporary_access } = req.body || {};
  const sets = [];
  const params = [];
  if (name !== undefined) {
    const e = validateString(name, 'name');
    if (e) return badRequest(res, e);
    params.push(name.trim()); sets.push(`name = $${params.length}`);
  }
  if (icon !== undefined) {
    if (icon !== null && typeof icon !== 'string') return badRequest(res, 'icon must be string or null');
    params.push(icon); sets.push(`icon = $${params.length}`);
  }
  if (opens_card !== undefined) {
    if (typeof opens_card !== 'boolean') return badRequest(res, 'opens_card must be boolean');
    params.push(opens_card); sets.push(`opens_card = $${params.length}`);
  }
  if (closes_card !== undefined) {
    if (typeof closes_card !== 'boolean') return badRequest(res, 'closes_card must be boolean');
    params.push(closes_card); sets.push(`closes_card = $${params.length}`);
  }
  if (grants_temporary_access !== undefined) {
    if (typeof grants_temporary_access !== 'boolean') return badRequest(res, 'grants_temporary_access must be boolean');
    params.push(grants_temporary_access); sets.push(`grants_temporary_access = $${params.length}`);
  }
  if (sets.length === 0) return badRequest(res, 'No fields to update');
  params.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE task_types SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, icon, opens_card, closes_card, grants_temporary_access`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'task type with this name already exists' });
    next(err);
  }
});

router.delete('/task-types/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid id');
  try {
    await pool.query(`DELETE FROM task_types WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'cannot delete: task type is referenced by existing tasks' });
    }
    next(err);
  }
});

// ── REPORT TYPES ──────────────────────────────────────────────────
router.post('/report-types', requireRole('admin'), async (req, res, next) => {
  const { name, icon } = req.body || {};
  const e = validateString(name, 'name');
  if (e) return badRequest(res, e);
  if (icon !== undefined && icon !== null && typeof icon !== 'string')
    return badRequest(res, 'icon must be string or null');

  try {
    const { rows } = await pool.query(
      `INSERT INTO report_types (name, icon) VALUES ($1, $2)
       RETURNING id, name, icon`,
      [name.trim(), icon || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'report type with this name already exists' });
    next(err);
  }
});

router.put('/report-types/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid id');

  const { name, icon } = req.body || {};
  const sets = [], params = [];
  if (name !== undefined) {
    const e = validateString(name, 'name');
    if (e) return badRequest(res, e);
    params.push(name.trim()); sets.push(`name = $${params.length}`);
  }
  if (icon !== undefined) {
    if (icon !== null && typeof icon !== 'string') return badRequest(res, 'icon must be string or null');
    params.push(icon); sets.push(`icon = $${params.length}`);
  }
  if (sets.length === 0) return badRequest(res, 'No fields to update');
  params.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE report_types SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, icon`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'report type with this name already exists' });
    next(err);
  }
});

router.delete('/report-types/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid id');
  try {
    await pool.query(`DELETE FROM report_types WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'cannot delete: report type is referenced by existing reports' });
    }
    next(err);
  }
});

// ── BOX TYPES ─────────────────────────────────────────────────────
const BOX_TYPE_KINDS = ['street', 'shop', 'other'];

router.post('/box-types', requireRole('admin'), async (req, res, next) => {
  const { name, kind } = req.body || {};
  const e = validateString(name, 'name');
  if (e) return badRequest(res, e);
  if (kind !== undefined && !BOX_TYPE_KINDS.includes(kind))
    return badRequest(res, `kind must be one of: ${BOX_TYPE_KINDS.join(', ')}`);
  try {
    const { rows } = await pool.query(
      `INSERT INTO box_types (name, kind) VALUES ($1, COALESCE($2, 'street'))
       RETURNING id, name, kind`,
      [name.trim(), kind || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'box type with this name already exists' });
    next(err);
  }
});

router.put('/box-types/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid id');

  const { name, kind } = req.body || {};
  const sets = [];
  const params = [];
  if (name !== undefined) {
    const e = validateString(name, 'name');
    if (e) return badRequest(res, e);
    params.push(name.trim()); sets.push(`name = $${params.length}`);
  }
  if (kind !== undefined) {
    if (!BOX_TYPE_KINDS.includes(kind))
      return badRequest(res, `kind must be one of: ${BOX_TYPE_KINDS.join(', ')}`);
    params.push(kind); sets.push(`kind = $${params.length}`);
  }
  if (sets.length === 0) return badRequest(res, 'No fields to update');
  params.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE box_types SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, kind`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'box type with this name already exists' });
    next(err);
  }
});

router.delete('/box-types/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid id');
  try {
    await pool.query(`DELETE FROM box_types WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'cannot delete: box type is referenced by existing boxes' });
    }
    next(err);
  }
});

// ── CITIES & DISTRICTS ────────────────────────────────────────────
// One table — `cities(id, name UNIQUE, district)` — drives both lists.
// "Districts" are the DISTINCT non-null district values across rows.
// Rules in users.area_assignments can target a `district` value; the SQL
// fragment in userAssignment.js joins back to this table to expand a
// district rule into "all cities mapped to that district".

// Per-city alert threshold: optional integer 1..3650, or null to inherit the
// global default. Returns { value } (number|null) on success, { error } on
// invalid input. Accepts '' / null / undefined as "clear" (=> null).
function parseAlertDays(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n)) return { error: 'alert_days must be an integer' };
  if (n < 1)    return { error: 'alert_days must be >= 1' };
  if (n > 3650) return { error: 'alert_days must be <= 3650' };
  return { value: n };
}

// GET /api/settings/cities — full list with their districts
router.get('/cities', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, district, alert_days FROM cities ORDER BY name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/settings/districts — DISTINCT non-null district names
router.get('/districts', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT district AS name
         FROM cities
        WHERE district IS NOT NULL AND district <> ''
        ORDER BY district`
    );
    res.json(rows.map(r => r.name));
  } catch (err) { next(err); }
});

// GET /api/settings/unassigned-cities — cities that appear in cards.city but
// are NOT yet in the cities table (so district rules can't reach them and
// the admin should fix that).
router.get('/unassigned-cities', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT c.city AS name
        FROM cards c
        WHERE c.city IS NOT NULL AND c.city <> ''
          AND NOT EXISTS (SELECT 1 FROM cities ci WHERE ci.name = c.city)
        ORDER BY c.city
    `);
    res.json(rows.map(r => r.name));
  } catch (err) { next(err); }
});

router.post('/cities', requireRole('admin'), async (req, res, next) => {
  const { name, district, alert_days } = req.body || {};
  const e = validateString(name, 'name');
  if (e) return badRequest(res, e);
  if (district !== undefined && district !== null && typeof district !== 'string')
    return badRequest(res, 'district must be string or null');
  const ad = parseAlertDays(alert_days);
  if (ad.error) return badRequest(res, ad.error);
  try {
    const { rows } = await pool.query(
      `INSERT INTO cities (name, district, alert_days) VALUES ($1, $2, $3)
       RETURNING id, name, district, alert_days`,
      [name.trim(), district ? district.trim() : null, ad.value]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'city with this name already exists' });
    next(err);
  }
});

router.put('/cities/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid id');

  const { name, district, alert_days } = req.body || {};
  const sets = [], params = [];
  if (name !== undefined) {
    const e = validateString(name, 'name');
    if (e) return badRequest(res, e);
    params.push(name.trim()); sets.push(`name = $${params.length}`);
  }
  if (district !== undefined) {
    if (district !== null && typeof district !== 'string')
      return badRequest(res, 'district must be string or null');
    params.push(district ? district.trim() : null); sets.push(`district = $${params.length}`);
  }
  if (alert_days !== undefined) {
    const ad = parseAlertDays(alert_days);
    if (ad.error) return badRequest(res, ad.error);
    params.push(ad.value); sets.push(`alert_days = $${params.length}`);
  }
  if (sets.length === 0) return badRequest(res, 'No fields to update');
  params.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE cities SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, district, alert_days`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'city with this name already exists' });
    next(err);
  }
});

router.delete('/cities/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, 'Invalid id');
  try {
    await pool.query(`DELETE FROM cities WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Rename a district across every city mapped to it (so the admin can edit
// "districts" even though they're just a free-text column).
// Body: { from: 'oldName', to: 'newName' }
router.put('/districts/rename', requireRole('admin'), async (req, res, next) => {
  const { from, to } = req.body || {};
  const ef = validateString(from, 'from');
  if (ef) return badRequest(res, ef);
  // `to` may be empty to clear the district from all cities.
  if (to !== undefined && to !== null && typeof to !== 'string')
    return badRequest(res, 'to must be string or null');
  try {
    const { rowCount } = await pool.query(
      `UPDATE cities SET district = $1 WHERE district = $2`,
      [to ? to.trim() : null, from.trim()]
    );
    res.json({ updated: rowCount });
  } catch (err) { next(err); }
});

// ─── routes ───────────────────────────────────────────────────────

// GET /api/settings/maps-key  — returns the Google Maps API key in plaintext
// so the frontend can load the Maps JavaScript API. Authenticated users only.
// The key is expected to be protected by an HTTP-referrer restriction in
// Google Cloud Console, so exposing it to the browser is safe.
router.get('/maps-key', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE key = 'google_maps_api_key' LIMIT 1`
    );
    const key = rows[0]?.value;
    res.json({ key: typeof key === 'string' && key.trim() ? key.trim() : '' });
  } catch (err) { next(err); }
});

// GET /api/settings  — returns all allowed settings (with defaults if missing).
// Sensitive fields are masked: their value is replaced with a boolean
// `<key>_set` flag so the UI knows whether one is configured without
// leaking the actual secret.
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT key, value FROM settings`);
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const out = {};
    for (const [k, schema] of Object.entries(SETTINGS_SCHEMA)) {
      const v = map[k] !== undefined ? map[k] : (schema.default ?? null);
      if (schema.sensitive) {
        out[`${k}_set`] = !!(v && String(v).trim());
      } else {
        out[k] = v;
      }
    }
    res.json(out);
  } catch (err) { next(err); }
});

// PUT /api/settings  — body: { key: value, ... }, admin only
router.put('/', requireRole('admin'), async (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'body must be an object' });
  }
  const entries = Object.entries(body);
  if (entries.length === 0) return res.status(400).json({ error: 'No settings provided' });

  // Validate every entry up-front (reject the whole request on any error)
  const validated = [];
  for (const [key, rawValue] of entries) {
    const result = coerceAndValidate(key, rawValue);
    if (result.error) return res.status(400).json({ error: result.error });
    validated.push([key, result.value]);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of validated) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    await client.query('COMMIT');

    const { rows } = await pool.query(`SELECT key, value FROM settings`);
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const out = {};
    for (const [k, schema] of Object.entries(SETTINGS_SCHEMA)) {
      const v = map[k] !== undefined ? map[k] : (schema.default ?? null);
      if (schema.sensitive) {
        out[`${k}_set`] = !!(v && String(v).trim());
      } else {
        out[k] = v;
      }
    }
    res.json(out);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
