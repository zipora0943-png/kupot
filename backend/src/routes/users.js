const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');

router.use(authenticate, requireRole('admin'));

const VALID_ROLES = ['admin', 'collector', 'cashroom'];
const MIN_PASSWORD_LEN = 6;

const PUBLIC_COLUMNS = `
  id, name, username, role, area_assignments, area_exclusions, active, permissions, created_at
`;

// Task 50: permissions JSONB has a strict schema. Keys are validated against
// this whitelist; unknown keys are stripped. Values must match the expected type.
const PERMISSION_SPEC = {
  can_self_report_tasks: 'boolean',
};

function validatePermissions(perms) {
  if (perms === undefined || perms === null) return { ok: true, value: undefined };
  if (typeof perms !== 'object' || Array.isArray(perms)) {
    return { ok: false, error: 'permissions must be a JSON object' };
  }
  const cleaned = {};
  for (const [k, v] of Object.entries(perms)) {
    const expected = PERMISSION_SPEC[k];
    if (!expected) continue; // ignore unknown
    if (expected === 'boolean' && typeof v !== 'boolean') {
      return { ok: false, error: `permissions.${k} must be boolean` };
    }
    cleaned[k] = v;
  }
  return { ok: true, value: cleaned };
}

// ─── helpers ──────────────────────────────────────────────────────
function validateRole(role) {
  return typeof role === 'string' && VALID_ROLES.includes(role);
}

function validateRules(rules) {
  if (rules === undefined || rules === null) return true;
  return Array.isArray(rules) && rules.every(r => r && typeof r === 'object');
}

// ─── routes ───────────────────────────────────────────────────────

// GET /api/users
router.get('/', async (req, res, next) => {
  const { role, search, active } = req.query;
  let q = `SELECT ${PUBLIC_COLUMNS} FROM users WHERE 1=1`;
  const p = [];
  if (validateRole(role)) { p.push(role); q += ` AND role = $${p.length}`; }
  if (active === 'true' || active === 'false') {
    p.push(active === 'true'); q += ` AND active = $${p.length}`;
  }
  if (typeof search === 'string' && search.trim()) {
    p.push(`%${search.trim().replace(/[%_]/g, '\\$&')}%`);
    q += ` AND (name ILIKE $${p.length} OR username ILIKE $${p.length})`;
  }
  q += ` ORDER BY id`;

  try {
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/users
router.post('/', async (req, res, next) => {
  const { name, username, password, role, area_assignments, area_exclusions, permissions } = req.body || {};
  if (typeof name !== 'string' || !name.trim())          return res.status(400).json({ error: 'name required' });
  if (typeof username !== 'string' || !username.trim())  return res.status(400).json({ error: 'username required' });
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LEN} chars` });
  }
  if (!validateRole(role))            return res.status(400).json({ error: 'role must be admin / collector / cashroom' });
  if (!validateRules(area_assignments)) return res.status(400).json({ error: 'area_assignments must be an array' });
  if (!validateRules(area_exclusions))  return res.status(400).json({ error: 'area_exclusions must be an array' });
  const permCheck = validatePermissions(permissions);
  if (!permCheck.ok) return res.status(400).json({ error: permCheck.error });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, username, password_hash, role, area_assignments, area_exclusions, permissions)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING ${PUBLIC_COLUMNS}`,
      [name.trim(), username.trim(), hash, role,
       JSON.stringify(area_assignments || []),
       JSON.stringify(area_exclusions  || []),
       JSON.stringify(permCheck.value || {})]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    next(err);
  }
});

// PUT /api/users/:id  — partial update (PATCH semantics)
router.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { name, username, password, role, area_assignments, area_exclusions, active, permissions } = req.body || {};

  // ── Self-protection: admin cannot demote, deactivate, or strip their own role
  const isSelf = id === req.user.id;
  if (isSelf) {
    if (role !== undefined && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    if (active === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
  }

  // ── Validate provided fields
  if (name !== undefined && (typeof name !== 'string' || !name.trim()))
    return res.status(400).json({ error: 'name must be a non-empty string' });
  if (username !== undefined && (typeof username !== 'string' || !username.trim()))
    return res.status(400).json({ error: 'username must be a non-empty string' });
  if (password !== undefined &&
      (typeof password !== 'string' || password.length < MIN_PASSWORD_LEN))
    return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LEN} chars` });
  if (role !== undefined && !validateRole(role))
    return res.status(400).json({ error: 'role must be admin / collector / cashroom' });
  if (area_assignments !== undefined && !validateRules(area_assignments))
    return res.status(400).json({ error: 'area_assignments must be an array' });
  if (area_exclusions !== undefined && !validateRules(area_exclusions))
    return res.status(400).json({ error: 'area_exclusions must be an array' });
  if (active !== undefined && typeof active !== 'boolean')
    return res.status(400).json({ error: 'active must be boolean' });
  const permCheck = validatePermissions(permissions);
  if (!permCheck.ok) return res.status(400).json({ error: permCheck.error });

  // ── Build dynamic UPDATE — only fields that were sent
  const sets = [];
  const params = [];
  if (name !== undefined)             { params.push(name.trim());     sets.push(`name = $${params.length}`); }
  if (username !== undefined)         { params.push(username.trim()); sets.push(`username = $${params.length}`); }
  if (password !== undefined) {
    const hash = await bcrypt.hash(password, 10);
    params.push(hash); sets.push(`password_hash = $${params.length}`);
  }
  if (role !== undefined)             { params.push(role);            sets.push(`role = $${params.length}`); }
  if (area_assignments !== undefined) { params.push(JSON.stringify(area_assignments)); sets.push(`area_assignments = $${params.length}`); }
  if (area_exclusions !== undefined)  { params.push(JSON.stringify(area_exclusions));  sets.push(`area_exclusions = $${params.length}`); }
  if (active !== undefined)           { params.push(active);          sets.push(`active = $${params.length}`); }
  if (permissions !== undefined)      { params.push(JSON.stringify(permCheck.value || {})); sets.push(`permissions = $${params.length}`); }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${PUBLIC_COLUMNS}`;

  try {
    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    next(err);
  }
});

// DELETE /api/users/:id  — soft delete
router.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot deactivate your own account' });

  try {
    const { rows } = await pool.query(
      `UPDATE users SET active = FALSE WHERE id = $1 RETURNING id`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
