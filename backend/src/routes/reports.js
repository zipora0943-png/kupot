const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { getActiveCard, EVENT } = require('../logic/cardLogic');
const { isCardAssignedToCollector, isBoxAssignedToCollector, buildLocationClause } = require('../logic/userAssignment');

router.use(authenticate);

const VALID_STATUSES = ['open', 'converted', 'closed'];

// ─── routes ───────────────────────────────────────────────────────

// GET /api/reports
router.get('/', async (req, res, next) => {
  const { status, card_id, reported_by, report_type_id } = req.query;

  let q = `SELECT r.*, rt.name AS type_name, rt.icon,
                  c.city, c.neighborhood, c.street, b.iron_number,
                  u.name AS reporter_name
             FROM reports r
             JOIN cards c ON c.id = r.card_id
             JOIN boxes b ON b.id = c.box_id
             LEFT JOIN report_types rt ON rt.id = r.report_type_id
             LEFT JOIN users u ON u.id = r.reported_by
            WHERE 1=1`;
  const p = [];

  // ── Collector: see only reports they created OR on cards assigned to them
  if (req.user.role === 'collector') {
    try {
      const { rows: userRows } = await pool.query(
        `SELECT area_assignments, area_exclusions FROM users WHERE id=$1 AND active=TRUE`,
        [req.user.id]
      );
      if (!userRows[0]) return res.json([]);
      const incClause = buildLocationClause(userRows[0].area_assignments || [], p);
      if (!incClause) return res.json([]);
      q += ` AND ${incClause}`;
      const excClause = buildLocationClause(userRows[0].area_exclusions || [], p);
      if (excClause) q += ` AND NOT ${excClause}`;
    } catch (err) { return next(err); }
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    p.push(status); q += ` AND r.status = $${p.length}`;
  }
  if (card_id !== undefined) {
    const cid = Number(card_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: 'Invalid card_id' });
    p.push(cid); q += ` AND r.card_id = $${p.length}`;
  }
  if (reported_by !== undefined) {
    const rid = Number(reported_by);
    if (!Number.isInteger(rid)) return res.status(400).json({ error: 'Invalid reported_by' });
    p.push(rid); q += ` AND r.reported_by = $${p.length}`;
  }
  if (report_type_id !== undefined) {
    const tid = Number(report_type_id);
    if (!Number.isInteger(tid)) return res.status(400).json({ error: 'Invalid report_type_id' });
    p.push(tid); q += ` AND r.report_type_id = $${p.length}`;
  }
  q += ` ORDER BY r.created_at DESC`;

  try {
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/reports/:id
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows } = await pool.query(
      `SELECT r.*, rt.name AS type_name, rt.icon,
              c.city, c.neighborhood, c.street, c.building, c.id AS card_id_full,
              b.iron_number, b.id AS box_id, u.name AS reporter_name
         FROM reports r
         JOIN cards c ON c.id = r.card_id
         JOIN boxes b ON b.id = c.box_id
         LEFT JOIN report_types rt ON rt.id = r.report_type_id
         LEFT JOIN users u ON u.id = r.reported_by
        WHERE r.id = $1`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    if (req.user.role === 'collector' &&
        !(await isCardAssignedToCollector(rows[0].card_id, req.user.id))) {
      return res.status(403).json({ error: 'Not authorized for this report' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/reports  — admin/collector
router.post('/', requireRole('admin', 'collector'), async (req, res, next) => {
  const { box_id, card_id, report_type_id, description, image_path } = req.body || {};

  if (typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description required' });
  }
  if (image_path !== undefined && image_path !== null && typeof image_path !== 'string') {
    return res.status(400).json({ error: 'image_path must be string or null' });
  }
  if (report_type_id !== undefined && report_type_id !== null) {
    if (!Number.isInteger(Number(report_type_id))) {
      return res.status(400).json({ error: 'Invalid report_type_id' });
    }
  }

  try {
    let resolvedCardId = card_id !== undefined && card_id !== null ? Number(card_id) : null;
    let resolvedBoxId  = null;

    if (resolvedCardId !== null) {
      if (!Number.isInteger(resolvedCardId)) return res.status(400).json({ error: 'Invalid card_id' });
      const { rows } = await pool.query(`SELECT box_id FROM cards WHERE id=$1`, [resolvedCardId]);
      if (!rows[0]) return res.status(400).json({ error: 'card_id does not exist' });
      resolvedBoxId = rows[0].box_id;
    } else if (box_id !== undefined && box_id !== null) {
      const bid = Number(box_id);
      if (!Number.isInteger(bid)) return res.status(400).json({ error: 'Invalid box_id' });
      const card = await getActiveCard(bid);
      if (!card) return res.status(400).json({ error: 'No active card for this box' });
      resolvedCardId = card.id;
      resolvedBoxId  = bid;
    } else {
      return res.status(400).json({ error: 'card_id or box_id required' });
    }

    if (req.user.role === 'collector' &&
        !(await isBoxAssignedToCollector(resolvedBoxId, req.user.id))) {
      return res.status(403).json({ error: 'Box not assigned to this collector' });
    }

    const { rows } = await pool.query(
      `INSERT INTO reports (card_id, report_type_id, description, reported_by, image_path)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [resolvedCardId,
       report_type_id != null ? Number(report_type_id) : null,
       description.trim(),
       req.user.id,
       typeof image_path === 'string' ? image_path : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid foreign key' });
    next(err);
  }
});

// PUT /api/reports/:id  — partial update, admin only
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { status, description } = req.body || {};
  const sets = [];
  const params = [];

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    params.push(status); sets.push(`status = $${params.length}`);
  }
  if (description !== undefined) {
    if (typeof description !== 'string') return res.status(400).json({ error: 'description must be string' });
    params.push(description); sets.push(`description = $${params.length}`);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  // updated_at is set by DB trigger automatically
  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE reports SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/reports/:id/close  — admin only
// Close a report directly (without converting to task) and log a `report_closed`
// event linked to the report's card_id. Optional `reason` is included in the
// event description.
router.post('/:id/close', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const reason = (req.body && typeof req.body.reason === 'string') ? req.body.reason.trim() : '';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM reports WHERE id=$1 FOR UPDATE`, [id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const report = rows[0];

    if (report.status === 'closed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Report is already closed' });
    }
    if (report.status === 'converted') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Report has been converted to a task' });
    }

    const { rows: upd } = await client.query(
      `UPDATE reports SET status='closed', closure_reason=$2 WHERE id=$1 RETURNING *`,
      [id, reason || null]
    );

    const description = reason ? `סגירת דיווח: ${reason}` : 'סגירת דיווח';
    await client.query(
      `INSERT INTO events (card_id, event_type, description, user_id) VALUES ($1,$2,$3,$4)`,
      [report.card_id, EVENT.REPORT_CLOSED, description, req.user.id]
    );

    await client.query('COMMIT');
    res.json(upd[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/reports/:id/convert-to-task  — admin only
router.post('/:id/convert-to-task', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { task_type_id, assigned_to, close_report,
          new_city, new_neighborhood, new_street, new_building, new_location_notes } = req.body || {};
  const ttid = Number(task_type_id);
  if (!Number.isInteger(ttid)) return res.status(400).json({ error: 'task_type_id required' });

  let aid = null;
  if (assigned_to !== undefined && assigned_to !== null) {
    aid = Number(assigned_to);
    if (!Number.isInteger(aid)) return res.status(400).json({ error: 'Invalid assigned_to' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: rRows } = await client.query(`SELECT * FROM reports WHERE id=$1`, [id]);
    if (!rRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found' });
    }
    const report = rRows[0];

    const { rows: cardRows } = await client.query(
      `SELECT box_id FROM cards WHERE id=$1`, [report.card_id]
    );
    if (!cardRows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Linked card not found' });
    }

    const { rows: taskRows } = await client.query(
      `INSERT INTO tasks (box_id, card_id, task_type_id, assigned_to, created_by, notes,
                           new_city, new_neighborhood, new_street, new_building, new_location_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [cardRows[0].box_id, report.card_id, ttid, aid, req.user.id,
       report.description,
       new_city ?? null, new_neighborhood ?? null, new_street ?? null,
       new_building ?? null, new_location_notes ?? null]
    );
    const task = taskRows[0];

    await client.query(
      `UPDATE reports SET task_id=$1, status=$2 WHERE id=$3`,
      [task.id, close_report ? 'closed' : 'converted', report.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ task, report_id: report.id });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid foreign key' });
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
