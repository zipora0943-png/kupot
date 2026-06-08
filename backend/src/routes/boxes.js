const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { openCard, closeActiveCardForBox, EVENT } = require('../logic/cardLogic');
const { getBoxesForCollector, isBoxAssignedToCollector } = require('../logic/userAssignment');

router.use(authenticate);
// Task 36: cashroom users have no access to box data — only the cashroom workflow.
// Maintenance (תחזוקה) reads boxes country-wide (no area filter applies below).
router.use(requireRole('admin', 'collector', 'maintenance'));

const VALID_STATUSES = ['uninstalled', 'active', 'inactive', 'unusable'];

// GET /api/boxes
router.get('/', async (req, res, next) => {
  const { status, box_type_id, search } = req.query;

  // ── Collector: see only assigned boxes
  if (req.user.role === 'collector') {
    try {
      const cards = await getBoxesForCollector(req.user.id);
      let filtered = cards;
      if (status && VALID_STATUSES.includes(status)) {
        filtered = filtered.filter(c => c.box_status === status);
      }
      if (typeof search === 'string' && search.trim()) {
        const s = search.trim();
        filtered = filtered.filter(c => c.iron_number && c.iron_number.includes(s));
      }
      // Map shape to look like the admin/cashroom response
      const boxes = filtered.map(c => ({
        id: c.box_id,
        iron_number: c.iron_number,
        status: c.box_status,
        active_card_id: c.card_id,
        city: c.city, neighborhood: c.neighborhood, street: c.street, building: c.building,
      }));
      return res.json(boxes);
    } catch (err) { return next(err); }
  }

  // ── Admin / cashroom: full list with filters
  let q = `SELECT b.*, bt.name AS box_type_name
             FROM boxes b
             LEFT JOIN box_types bt ON bt.id = b.box_type_id
            WHERE 1=1`;
  const p = [];
  if (status && VALID_STATUSES.includes(status)) {
    p.push(status); q += ` AND b.status = $${p.length}`;
  }
  if (box_type_id !== undefined) {
    const tid = Number(box_type_id);
    if (!Number.isInteger(tid)) return res.status(400).json({ error: 'Invalid box_type_id' });
    p.push(tid); q += ` AND b.box_type_id = $${p.length}`;
  }
  if (typeof search === 'string' && search.trim()) {
    p.push(`%${search.trim().replace(/[%_]/g, '\\$&')}%`);
    q += ` AND b.iron_number ILIKE $${p.length}`;
  }
  q += ` ORDER BY b.id`;

  try {
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/boxes/:id
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    if (req.user.role === 'collector') {
      const allowed = await isBoxAssignedToCollector(id, req.user.id);
      if (!allowed) return res.status(403).json({ error: 'Box not assigned to this collector' });
    }

    const { rows } = await pool.query(
      `SELECT b.*, bt.name AS box_type_name
         FROM boxes b
         LEFT JOIN box_types bt ON bt.id = b.box_type_id
        WHERE b.id = $1`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/boxes  — admin only.
// Task 49: every new box also opens its first card in the same transaction.
// `city` is required (same rule as completeTask for installation tasks);
// the box is created with status='active' (not 'uninstalled') because a
// card is opened immediately.
router.post('/', requireRole('admin'), async (req, res, next) => {
  const {
    iron_number, box_type_id, notes,
    // card fields
    city, neighborhood, street, building, location_notes,
    custom_name, alert_days_personal,
    receipt_required, receipt_details, installation_type,
  } = req.body || {};

  if (typeof iron_number !== 'string' || !iron_number.trim()) {
    return res.status(400).json({ error: 'iron_number required' });
  }
  if (box_type_id !== undefined && box_type_id !== null) {
    if (!Number.isInteger(Number(box_type_id))) return res.status(400).json({ error: 'Invalid box_type_id' });
  }
  if (typeof city !== 'string' || !city.trim()) {
    return res.status(400).json({ error: 'city required (כל יצירת קופה פותחת גם כרטסת)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: boxRows } = await client.query(
      `INSERT INTO boxes (iron_number, box_type_id, notes, status)
       VALUES ($1, $2, $3, 'active') RETURNING *`,
      [iron_number.trim(),
       box_type_id != null ? Number(box_type_id) : null,
       typeof notes === 'string' ? notes : null]
    );
    const box = boxRows[0];

    const card = await openCard(
      box.id,
      {
        city: city.trim(),
        neighborhood: typeof neighborhood === 'string' ? neighborhood.trim() || null : null,
        street: typeof street === 'string' ? street.trim() || null : null,
        building: typeof building === 'string' ? building.trim() || null : null,
        location_notes: typeof location_notes === 'string' ? location_notes.trim() || null : null,
        custom_name: typeof custom_name === 'string' ? custom_name.trim() || null : null,
        alert_days_personal: alert_days_personal === '' || alert_days_personal == null
                              ? null
                              : Number(alert_days_personal),
        receipt_required: !!receipt_required,
        receipt_details: typeof receipt_details === 'string' ? receipt_details.trim() || null : null,
        installation_type: typeof installation_type === 'string' ? installation_type.trim() || null : null,
      },
      req.user.id,
      client,
      EVENT.INSTALLATION,
    );
    await client.query('COMMIT');
    res.status(201).json({ ...box, card });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'iron_number already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid box_type_id' });
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/boxes/:id  — partial update (PATCH semantics), admin only
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { iron_number, box_type_id, notes } = req.body || {};
  const sets = [];
  const params = [];

  if (iron_number !== undefined) {
    if (typeof iron_number !== 'string' || !iron_number.trim())
      return res.status(400).json({ error: 'iron_number must be a non-empty string' });
    params.push(iron_number.trim()); sets.push(`iron_number = $${params.length}`);
  }
  if (box_type_id !== undefined) {
    if (box_type_id !== null && !Number.isInteger(Number(box_type_id)))
      return res.status(400).json({ error: 'Invalid box_type_id' });
    params.push(box_type_id === null ? null : Number(box_type_id));
    sets.push(`box_type_id = $${params.length}`);
  }
  if (notes !== undefined) {
    if (notes !== null && typeof notes !== 'string')
      return res.status(400).json({ error: 'notes must be string or null' });
    params.push(notes); sets.push(`notes = $${params.length}`);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE boxes SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'iron_number already exists' });
    next(err);
  }
});

// PATCH /api/boxes/:id/status  — admin only
// Side effects:
//   - 'inactive' or 'uninstalled' → auto-close any active card for the box
//     (one transaction, with a 'removal' event)
//   - 'unusable' → auto-close any active card with a 'mark_unusable' event
router.patch('/:id/status', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { status, reason } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE boxes SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    if (status === 'unusable') {
      await closeActiveCardForBox(
        id,
        reason || 'קופה סומנה כלא שמישה',
        req.user.id,
        client,
        EVENT.MARK_UNUSABLE,
      );
    } else if (status === 'inactive' || status === 'uninstalled') {
      await closeActiveCardForBox(
        id,
        reason || `קופה הפכה ל-${status}`,
        req.user.id,
        client,
        EVENT.REMOVAL,
      );
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
