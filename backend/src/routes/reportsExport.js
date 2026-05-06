const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { sendCsv }      = require('../utils/csv');
const { RESOLVED_COLLECTORS_LATERAL } = require('../logic/userAssignment');

// Task 36: cashroom users have no access to dochot — only the cashroom workflow.
router.use(authenticate, requireRole('admin'));

// helper: extract `format=csv` query and short-circuit to CSV when requested
function maybeCsv(req, res, rows, filename, columns) {
  if ((req.query.format || '').toLowerCase() === 'csv') {
    return sendCsv(res, filename, rows, columns);
  }
  return res.json(rows);
}

// ─── helpers ──────────────────────────────────────────────────────
function parseDate(value, endOfDay = false) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d.toISOString();
}

// ─── routes ───────────────────────────────────────────────────────

// GET /api/reports-export/summary
// Total amount and envelope count per city, over a period.
router.get('/summary', async (req, res, next) => {
  const { from, to, city } = req.query;

  let q = `SELECT c.city,
                  COUNT(e.id)     AS envelope_count,
                  SUM(e.amount)   AS total_amount,
                  MIN(e.collected_at) AS from_date,
                  MAX(e.collected_at) AS to_date
             FROM envelopes e
             JOIN cards c ON c.id = e.card_id
            WHERE e.status = 'entered'`;
  const p = [];

  if (from !== undefined) {
    const d = parseDate(from);
    if (!d) return res.status(400).json({ error: 'Invalid from' });
    p.push(d); q += ` AND e.collected_at >= $${p.length}`;
  }
  if (to !== undefined) {
    const d = parseDate(to, true);
    if (!d) return res.status(400).json({ error: 'Invalid to' });
    p.push(d); q += ` AND e.collected_at <= $${p.length}`;
  }
  if (typeof city === 'string' && city) {
    p.push(city); q += ` AND c.city = $${p.length}`;
  }
  q += ` GROUP BY c.city ORDER BY total_amount DESC NULLS LAST`;

  try {
    const { rows } = await pool.query(q, p);
    maybeCsv(req, res, rows, 'summary.csv',
      ['city', 'envelope_count', 'total_amount', 'from_date', 'to_date']);
  } catch (err) { next(err); }
});

// GET /api/reports-export/per-box
// Per-box breakdown. Uses subqueries to avoid the Cartesian-product
// pitfall when joining envelopes and events at the card level.
// Note: financial figures are based exclusively on envelopes.
router.get('/per-box', async (req, res, next) => {
  const { from, to, city, status, custom_name, receipt_required } = req.query;

  // Build envelope-aggregate subquery with optional date filter.
  // Counts/totals are scoped to the period; `last_collection_date` is
  // computed separately (below) so it always reflects the actual most
  // recent collection — even when it predates the report period.
  const envParams = [];
  let envWhere = `WHERE status = 'entered'`;
  if (from !== undefined) {
    const d = parseDate(from);
    if (!d) return res.status(400).json({ error: 'Invalid from' });
    envParams.push(d); envWhere += ` AND collected_at >= $${envParams.length}`;
  }
  if (to !== undefined) {
    const d = parseDate(to, true);
    if (!d) return res.status(400).json({ error: 'Invalid to' });
    envParams.push(d); envWhere += ` AND collected_at <= $${envParams.length}`;
  }
  const envSubquery = `
    SELECT card_id,
           COUNT(*) AS collection_count,
           SUM(amount) AS total_amount
      FROM envelopes
      ${envWhere}
      GROUP BY card_id`;

  // All-time last collection per card (no date filter).
  const lastCollectionSubquery = `
    SELECT card_id,
           MAX(collected_at) AS last_collection_date
      FROM envelopes
     WHERE status = 'entered'
     GROUP BY card_id`;

  // Outer query joins boxes/cards once + the aggregate subquery
  const params = [...envParams];
  let q = `
    SELECT c.id AS card_id,
           b.id AS box_id,
           b.iron_number,
           b.box_type_id,
           bt.name AS box_type_name,
           c.city, c.neighborhood, c.street, c.building, c.custom_name,
           c.receipt_required,
           rc.ids       AS collector_ids,
           rc.names_arr AS collector_names,
           rc.names     AS collector_name,
           COALESCE(e.collection_count, 0) AS collection_count,
           COALESCE(e.total_amount, 0)     AS total_amount,
           lc.last_collection_date
      FROM cards c
      JOIN boxes b ON b.id = c.box_id
      LEFT JOIN box_types bt ON bt.id = b.box_type_id
      ${RESOLVED_COLLECTORS_LATERAL}
      LEFT JOIN ( ${envSubquery} ) e ON e.card_id = c.id
      LEFT JOIN ( ${lastCollectionSubquery} ) lc ON lc.card_id = c.id
     WHERE 1=1`;

  if (typeof city === 'string' && city) {
    params.push(city); q += ` AND c.city = $${params.length}`;
  }
  if (status !== undefined) {
    if (!['active', 'closed'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    params.push(status); q += ` AND c.status = $${params.length}`;
  }
  if (typeof custom_name === 'string' && custom_name.trim()) {
    params.push(`%${custom_name.trim()}%`);
    q += ` AND c.custom_name ILIKE $${params.length}`;
  }
  if (receipt_required !== undefined) {
    if (receipt_required === 'true' || receipt_required === '1') {
      q += ` AND c.receipt_required = TRUE`;
    } else if (receipt_required === 'false' || receipt_required === '0') {
      q += ` AND c.receipt_required = FALSE`;
    } else {
      return res.status(400).json({ error: 'Invalid receipt_required' });
    }
  }
  q += ` ORDER BY c.city, total_amount DESC NULLS LAST`;

  try {
    const { rows } = await pool.query(q, params);
    maybeCsv(req, res, rows, 'per-box.csv',
      ['iron_number', 'box_type_id', 'box_type_name',
       'city', 'neighborhood', 'street', 'building',
       'custom_name', 'receipt_required', 'collector_name',
       'collection_count', 'total_amount', 'last_collection_date']);
  } catch (err) { next(err); }
});

// GET /api/reports-export/compare
// Period-over-period comparison per box.
router.get('/compare', async (req, res, next) => {
  const { from1, to1, from2, to2 } = req.query;
  const f1 = parseDate(from1);
  const t1 = parseDate(to1, true);
  const f2 = parseDate(from2);
  const t2 = parseDate(to2, true);
  if (!f1 || !t1 || !f2 || !t2) {
    return res.status(400).json({ error: 'from1, to1, from2, to2 required (valid dates)' });
  }
  if (new Date(f1) > new Date(t1) || new Date(f2) > new Date(t2)) {
    return res.status(400).json({ error: 'from must be earlier than to within each period' });
  }

  try {
    const q = (from, to) => pool.query(
      `SELECT c.box_id, b.iron_number, c.city, SUM(e.amount) AS total
         FROM envelopes e
         JOIN cards c ON c.id = e.card_id
         JOIN boxes b ON b.id = c.box_id
        WHERE e.status = 'entered'
          AND e.collected_at >= $1
          AND e.collected_at <= $2
        GROUP BY c.box_id, b.iron_number, c.city`,
      [from, to]
    );

    const [p1, p2] = await Promise.all([q(f1, t1), q(f2, t2)]);

    const map1 = new Map(p1.rows.map(r => [Number(r.box_id), r]));
    const map2 = new Map(p2.rows.map(r => [Number(r.box_id), r]));
    const allIds = new Set([...map1.keys(), ...map2.keys()]);

    const result = [...allIds].map(id => {
      const a = map1.get(id);
      const b = map2.get(id);
      const total1 = parseFloat((a && a.total) || 0);
      const total2 = parseFloat((b && b.total) || 0);
      return {
        box_id:      id,
        iron_number: (a || b).iron_number,
        city:        (a || b).city,
        period1:     total1,
        period2:     total2,
        diff:        total2 - total1,
        diff_pct:    total1 ? Math.round(((total2 - total1) / total1) * 100) : null,
      };
    });

    maybeCsv(req, res, result, 'compare.csv',
      ['box_id', 'iron_number', 'city', 'period1', 'period2', 'diff', 'diff_pct']);
  } catch (err) { next(err); }
});

module.exports = router;
