const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { getActiveCard, EVENT } = require('../logic/cardLogic');
const { isBoxAssignedToCollector, buildLocationClause } = require('../logic/userAssignment');

router.use(authenticate);

const VALID_STATUSES = ['pending', 'entered'];

// ─── helpers ──────────────────────────────────────────────────────
function parseDateBoundary(value, end = false) {
  // Accepts 'YYYY-MM-DD' or full ISO. If date-only and end=true,
  // treat as the end of that day (exclusive next-day boundary handled by caller).
  if (typeof value !== 'string' || !value.trim()) return null;
  // Validate ISO-ish; reject obvious junk
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// ─── routes ───────────────────────────────────────────────────────

// GET /api/envelopes
router.get('/', async (req, res, next) => {
  const { status, collector_id, city, from, to, card_id } = req.query;

  let q = `SELECT e.*, c.city, c.neighborhood, c.street, c.building,
                  b.iron_number, uc.name AS collector_name
             FROM envelopes e
             JOIN cards c ON c.id = e.card_id
             JOIN boxes b ON b.id = c.box_id
             LEFT JOIN users uc ON uc.id = e.collected_by
            WHERE 1=1`;
  const p = [];

  // ── Collector: restrict to assigned areas (by card location)
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
    p.push(status); q += ` AND e.status = $${p.length}`;
  }
  if (collector_id !== undefined) {
    const cid = Number(collector_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: 'Invalid collector_id' });
    p.push(cid); q += ` AND e.collected_by = $${p.length}`;
  }
  if (typeof city === 'string' && city) { p.push(city); q += ` AND c.city = $${p.length}`; }
  if (card_id !== undefined) {
    const cid = Number(card_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: 'Invalid card_id' });
    p.push(cid); q += ` AND e.card_id = $${p.length}`;
  }
  if (from !== undefined) {
    const d = parseDateBoundary(from);
    if (!d) return res.status(400).json({ error: 'Invalid from' });
    p.push(d.toISOString()); q += ` AND e.collected_at >= $${p.length}`;
  }
  if (to !== undefined) {
    const d = parseDateBoundary(to, true);
    if (!d) return res.status(400).json({ error: 'Invalid to' });
    // make `to` inclusive of the whole day if a date-only string was given
    if (/^\d{4}-\d{2}-\d{2}$/.test(to.trim())) d.setUTCHours(23, 59, 59, 999);
    p.push(d.toISOString()); q += ` AND e.collected_at <= $${p.length}`;
  }
  q += ` ORDER BY e.collected_at DESC`;

  try {
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/envelopes/pending  — cashroom inbox
router.get('/pending', requireRole('admin', 'cashroom'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, b.iron_number, c.city, c.neighborhood, c.street, uc.name AS collector_name
         FROM envelopes e
         JOIN cards c ON c.id = e.card_id
         JOIN boxes b ON b.id = c.box_id
         LEFT JOIN users uc ON uc.id = e.collected_by
        WHERE e.status = 'pending'
        ORDER BY e.collected_at`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/envelopes/by-number/:number  — cashroom barcode scan flow
router.get('/by-number/:number', requireRole('admin', 'cashroom'), async (req, res, next) => {
  const number = String(req.params.number || '').trim();
  if (!number) return res.status(400).json({ error: 'envelope number required' });
  try {
    const { rows } = await pool.query(
      `SELECT e.*, b.iron_number, c.city, c.neighborhood, c.street, c.building,
              c.custom_name, uc.name AS collector_name
         FROM envelopes e
         JOIN cards c ON c.id = e.card_id
         JOIN boxes b ON b.id = c.box_id
         LEFT JOIN users uc ON uc.id = e.collected_by
        WHERE e.envelope_number = $1`,
      [number]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Envelope not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/envelopes/:id
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows } = await pool.query(
      `SELECT e.*, b.iron_number, b.id AS box_id, c.city, c.neighborhood, c.street, c.building,
              c.custom_name, uc.name AS collector_name
         FROM envelopes e
         JOIN cards c ON c.id = e.card_id
         JOIN boxes b ON b.id = c.box_id
         LEFT JOIN users uc ON uc.id = e.collected_by
        WHERE e.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    if (req.user.role === 'collector') {
      const allowed = await isBoxAssignedToCollector(rows[0].box_id, req.user.id);
      if (!allowed) return res.status(403).json({ error: 'Not authorized for this envelope' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/envelopes  — collector creates an envelope on collection
// No event is created here: envelopes and events are independent (envelopes are
// authoritative for financial reports and alerts).
router.post('/', requireRole('admin', 'collector'), async (req, res, next) => {
  const { box_id, envelope_number, notes } = req.body || {};
  const bid = Number(box_id);
  if (!Number.isInteger(bid)) return res.status(400).json({ error: 'box_id required' });
  if (typeof envelope_number !== 'string' || !envelope_number.trim()) {
    return res.status(400).json({ error: 'envelope_number required' });
  }

  try {
    // Permission: collector must be assigned to this box
    if (req.user.role === 'collector') {
      const allowed = await isBoxAssignedToCollector(bid, req.user.id);
      if (!allowed) return res.status(403).json({ error: 'Box not assigned to this collector' });
    }

    const card = await getActiveCard(bid);
    if (!card) return res.status(400).json({ error: 'No active card for this box' });

    const { rows } = await pool.query(
      `INSERT INTO envelopes (card_id, envelope_number, collected_by, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [card.id, envelope_number.trim(), req.user.id,
       typeof notes === 'string' ? notes : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'envelope_number already exists' });
    next(err);
  }
});

// PUT /api/envelopes/:id  — cashroom enters amount (only if pending)
router.put('/:id', requireRole('admin', 'cashroom'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { amount, notes } = req.body || {};
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number' });
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return res.status(400).json({ error: 'notes must be string or null' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE envelopes
          SET amount = $1,
              status = 'entered',
              entered_at = NOW(),
              entered_by = $2,
              notes = COALESCE($3, notes)
        WHERE id = $4 AND status = 'pending'
        RETURNING *`,
      [amt, req.user.id, notes ?? null, id]
    );
    if (!rows[0]) {
      // distinguish "not found" vs "already entered"
      const { rows: existing } = await pool.query(`SELECT id, status FROM envelopes WHERE id = $1`, [id]);
      if (!existing[0]) return res.status(404).json({ error: 'Not found' });
      return res.status(409).json({ error: 'Envelope already entered' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/envelopes/:id/amount  — edit the amount AFTER it was already entered.
// Creates an `amount_changed` event with the old and new amounts for audit trail.
router.patch('/:id/amount', requireRole('admin', 'cashroom'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { amount, reason } = req.body || {};
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number' });
  }
  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    return res.status(400).json({ error: 'reason must be string or null' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: current } = await client.query(
      `SELECT id, card_id, amount, status FROM envelopes WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!current[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const env = current[0];
    if (env.status !== 'entered') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Envelope must be entered before its amount can be edited' });
    }

    const oldAmount = env.amount == null ? null : Number(env.amount);
    if (oldAmount !== null && Number(oldAmount.toFixed(2)) === Number(amt.toFixed(2))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'New amount equals current amount' });
    }

    const { rows: updated } = await client.query(
      `UPDATE envelopes SET amount = $1 WHERE id = $2 RETURNING *`,
      [amt, id]
    );

    const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    const description =
      `שינוי סכום מעטפה: ${fmt(oldAmount)} → ${fmt(amt)}` +
      (trimmedReason ? ` (סיבה: ${trimmedReason})` : '');

    await client.query(
      `INSERT INTO events (card_id, event_type, description, user_id) VALUES ($1, $2, $3, $4)`,
      [env.card_id, EVENT.AMOUNT_CHANGED, description, req.user.id]
    );

    await client.query('COMMIT');
    res.json(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
