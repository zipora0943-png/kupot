const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.use(authenticate);
// Maintenance (תחזוקה) collects country-wide, so it can also hit the
// out-of-radius override path during a collection.
router.use(requireRole('admin', 'collector', 'maintenance'));

const MIN_REASON_LENGTH = 5;

// POST /api/location-overrides
// Body: { card_id, distance_meters, reason, gps_lat, gps_lng }
// Logged when a collector continues a collection even though their GPS was
// outside the radius from the card's geocoded address.
router.post('/', async (req, res, next) => {
  const { card_id, distance_meters, reason, gps_lat, gps_lng } = req.body || {};
  const cid = Number(card_id);
  if (!Number.isInteger(cid)) return res.status(400).json({ error: 'card_id required' });

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (trimmedReason.length < MIN_REASON_LENGTH) {
    return res.status(400).json({ error: `reason must be at least ${MIN_REASON_LENGTH} characters` });
  }

  const dist = Number(distance_meters);
  const distOk = Number.isFinite(dist) ? Math.round(dist) : null;
  const latOk = (typeof gps_lat === 'number' && !Number.isNaN(gps_lat)) ? gps_lat : null;
  const lngOk = (typeof gps_lng === 'number' && !Number.isNaN(gps_lng)) ? gps_lng : null;

  try {
    const { rows: cardRows } = await pool.query(`SELECT id FROM cards WHERE id = $1`, [cid]);
    if (!cardRows[0]) return res.status(404).json({ error: 'Card not found' });

    const { rows } = await pool.query(
      `INSERT INTO location_overrides
         (card_id, user_id, distance_meters, reason, gps_lat, gps_lng)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [cid, req.user.id, distOk, trimmedReason, latOk, lngOk],
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
