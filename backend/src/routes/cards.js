const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { openCard, closeCard, reopenCard, getActiveCard, EVENT } = require('../logic/cardLogic');
const {
  isCardAssignedToCollector, buildLocationClause, temporaryAccessClause,
  RESOLVED_COLLECTOR_LATERAL,
} = require('../logic/userAssignment');

// Overlay each row's collector_id / collector_name with the resolved values
// from the LATERAL subquery, so the rule-based hierarchy is the source of truth.
function applyResolvedCollector(row) {
  if (!row) return row;
  return {
    ...row,
    collector_id:   row.resolved_collector_id ?? null,
    collector_name: row.resolved_collector_name ?? null,
    resolved_collector_id: undefined,
    resolved_collector_name: undefined,
  };
}

router.use(authenticate);

const VALID_STATUSES = ['active', 'closed'];

// ─── helpers ──────────────────────────────────────────────────────
async function collectorCanSee(cardId, userId) {
  return isCardAssignedToCollector(cardId, userId);
}

// ─── routes ───────────────────────────────────────────────────────

// GET /api/cards  — with full filters
router.get('/', async (req, res, next) => {
  const { city, neighborhood, street, collector_id, status, custom_name, receipt_required, box_id } = req.query;

  let q = `SELECT c.*, b.iron_number,
                  rc.id   AS resolved_collector_id,
                  rc.name AS resolved_collector_name,
                  GREATEST(
                    (SELECT MAX(e.collected_at) FROM envelopes e WHERE e.card_id = c.id),
                    (SELECT MAX(ev.created_at)  FROM events    ev WHERE ev.card_id = c.id AND ev.event_type = 'collection')
                  ) AS last_collection_at,
                  EXISTS (SELECT 1 FROM reports r WHERE r.card_id = c.id AND r.status = 'open')        AS has_open_report,
                  EXISTS (SELECT 1 FROM tasks   t WHERE t.card_id = c.id AND t.status IN ('open','in_progress')) AS has_open_task
             FROM cards c
             JOIN boxes b ON b.id = c.box_id
             ${RESOLVED_COLLECTOR_LATERAL}
            WHERE 1=1`;
  const p = [];

  // ── Collector: restrict to assigned areas OR boxes with active grants_temporary_access task
  if (req.user.role === 'collector') {
    try {
      const { rows: userRows } = await pool.query(
        `SELECT area_assignments, area_exclusions FROM users WHERE id = $1 AND active = TRUE`,
        [req.user.id]
      );
      if (!userRows[0]) return res.json([]);
      const assignments = userRows[0].area_assignments || [];
      const exclusions  = userRows[0].area_exclusions  || [];
      const incClause = buildLocationClause(assignments, p);
      const excClause = buildLocationClause(exclusions, p);
      const areaBranch = incClause
        ? (excClause ? `(${incClause} AND NOT ${excClause})` : incClause)
        : 'FALSE';
      p.push(req.user.id);
      const tempBranch = temporaryAccessClause(p.length);
      q += ` AND (${areaBranch} OR ${tempBranch})`;
    } catch (err) { return next(err); }
  }

  if (typeof city === 'string' && city)         { p.push(city);         q += ` AND c.city = $${p.length}`; }
  if (typeof neighborhood === 'string' && neighborhood) { p.push(neighborhood); q += ` AND c.neighborhood = $${p.length}`; }
  if (typeof street === 'string' && street)     { p.push(street);       q += ` AND c.street = $${p.length}`; }
  if (collector_id !== undefined) {
    const cid = Number(collector_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: 'Invalid collector_id' });
    p.push(cid); q += ` AND rc.id = $${p.length}`;
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    p.push(status); q += ` AND c.status = $${p.length}`;
  }
  if (typeof custom_name === 'string' && custom_name) {
    p.push(`%${custom_name.replace(/[%_]/g, '\\$&')}%`);
    q += ` AND c.custom_name ILIKE $${p.length}`;
  }
  if (receipt_required === 'true' || receipt_required === 'false') {
    p.push(receipt_required === 'true'); q += ` AND c.receipt_required = $${p.length}`;
  }
  if (box_id !== undefined) {
    const bid = Number(box_id);
    if (!Number.isInteger(bid)) return res.status(400).json({ error: 'Invalid box_id' });
    p.push(bid); q += ` AND c.box_id = $${p.length}`;
  }
  q += ` ORDER BY c.id DESC`;

  try {
    const { rows } = await pool.query(q, p);
    res.json(rows.map(applyResolvedCollector));
  } catch (err) { next(err); }
});

// GET /api/cards/locations  — distinct city/neighborhood/street values currently
// stored in cards, for autocomplete combobox in card editing / task execution forms.
// Query params:
//   level         — required: 'city' | 'neighborhood' | 'street'
//   city          — required when level='neighborhood' or 'street' (filters to that city)
//   neighborhood  — optional when level='street' (further filters to that neighborhood)
// Returns: array of non-empty distinct strings, alphabetically sorted.
//
// Note: registered BEFORE GET /:id so '/locations' is not parsed as an id.
router.get('/locations', async (req, res, next) => {
  const { level, city, neighborhood } = req.query;
  if (!['city', 'neighborhood', 'street'].includes(level)) {
    return res.status(400).json({ error: "Invalid level (expected 'city' | 'neighborhood' | 'street')" });
  }
  if ((level === 'neighborhood' || level === 'street') && (typeof city !== 'string' || !city.trim())) {
    return res.status(400).json({ error: 'city is required for neighborhood/street levels' });
  }

  const col = level;
  const conds = [`${col} IS NOT NULL`, `btrim(${col}) <> ''`];
  const params = [];
  if (level !== 'city') {
    params.push(city);
    conds.push(`city = $${params.length}`);
  }
  if (level === 'street' && typeof neighborhood === 'string' && neighborhood.trim()) {
    params.push(neighborhood);
    conds.push(`neighborhood = $${params.length}`);
  }

  const sql = `SELECT DISTINCT ${col} AS v FROM cards WHERE ${conds.join(' AND ')} ORDER BY ${col}`;
  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(r => r.v));
  } catch (err) { next(err); }
});

// GET /api/cards/:id
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    if (req.user.role === 'collector' && !(await collectorCanSee(id, req.user.id))) {
      return res.status(403).json({ error: 'Card not assigned to this collector' });
    }
    const { rows } = await pool.query(
      `SELECT c.*, b.iron_number, b.status AS box_status, bt.name AS box_type_name,
              rc.id   AS resolved_collector_id,
              rc.name AS resolved_collector_name
         FROM cards c
         JOIN boxes b ON b.id = c.box_id
         LEFT JOIN box_types bt ON bt.id = b.box_type_id
         ${RESOLVED_COLLECTOR_LATERAL}
        WHERE c.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(applyResolvedCollector(rows[0]));
  } catch (err) { next(err); }
});

// POST /api/cards  — manual card creation, admin only
// Uses cardLogic.openCard so the unique-active-card rule is enforced
// and an installation event is created in the same transaction.
router.post('/', requireRole('admin'), async (req, res, next) => {
  const { box_id, city, neighborhood, street, building, location_notes,
          collector_id, custom_name, alert_days_personal,
          receipt_required, receipt_details } = req.body || {};

  const bid = Number(box_id);
  if (!Number.isInteger(bid)) return res.status(400).json({ error: 'box_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const card = await openCard(
      bid,
      { city, neighborhood, street, building, location_notes,
        collector_id, custom_name, alert_days_personal,
        receipt_required, receipt_details },
      req.user.id,
      client,
      EVENT.INSTALLATION,
    );
    await client.query('COMMIT');
    res.status(201).json(card);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' || /already has an active card/.test(err.message)) {
      return res.status(409).json({ error: 'Box already has an active card' });
    }
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid box_id or collector_id' });
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/cards/:id  — partial update (PATCH semantics), admin only
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  // Note: collector_id is derived from user area-assignment rules at read time,
  // so we deliberately do not accept it here.
  const allowed = [
    'city', 'neighborhood', 'street', 'building', 'location_notes',
    'custom_name', 'alert_days_personal',
    'receipt_required', 'receipt_details',
  ];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      params.push(req.body[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE cards SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid foreign key (collector_id?)' });
    next(err);
  }
});

// POST /api/cards/:id/close  — admin closes a card manually
router.post('/:id/close', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const reason = (req.body && typeof req.body.reason === 'string') ? req.body.reason : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const card = await closeCard(id, reason, req.user.id, client, EVENT.CARD_CLOSED);
    await client.query('COMMIT');
    res.json(card);
  } catch (err) {
    await client.query('ROLLBACK');
    if (/not found or already closed/.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/cards/:id/reopen  — admin reopens a closed card
router.post('/:id/reopen', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const reason = (req.body && typeof req.body.reason === 'string') ? req.body.reason : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const card = await reopenCard(id, reason, req.user.id, client);
    await client.query('COMMIT');
    res.json(card);
  } catch (err) {
    await client.query('ROLLBACK');
    if (/Card not found/.test(err.message))            return res.status(404).json({ error: err.message });
    if (/Card is not closed/.test(err.message))        return res.status(409).json({ error: err.message });
    if (/Box not found/.test(err.message))             return res.status(404).json({ error: err.message });
    if (/marked unusable/.test(err.message))           return res.status(409).json({ error: err.message });
    if (/already has an active card/.test(err.message)) return res.status(409).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'Box already has an active card' });
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/cards/:id/history  — all cards for the same box
router.get('/:id/history', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    if (req.user.role === 'collector' && !(await collectorCanSee(id, req.user.id))) {
      return res.status(403).json({ error: 'Card not assigned to this collector' });
    }
    const { rows: card } = await pool.query(`SELECT box_id FROM cards WHERE id = $1`, [id]);
    if (!card[0]) return res.status(404).json({ error: 'Not found' });
    const { rows } = await pool.query(
      `SELECT c.*,
              rc.id   AS resolved_collector_id,
              rc.name AS resolved_collector_name
         FROM cards c
         ${RESOLVED_COLLECTOR_LATERAL}
        WHERE c.box_id = $1 ORDER BY c.opened_at`,
      [card[0].box_id]
    );
    res.json(rows.map(applyResolvedCollector));
  } catch (err) { next(err); }
});

module.exports = router;
