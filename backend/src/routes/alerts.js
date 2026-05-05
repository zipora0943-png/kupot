const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { buildLocationClause, RESOLVED_COLLECTOR_LATERAL } = require('../logic/userAssignment');

router.use(authenticate);

// Default grace period for newly-opened cards before they can trigger alerts.
// Cards opened more recently than threshold_days ago are excluded.
//
// GET /api/alerts/no-collection
// Returns active cards where last collection (envelopes.collected_at) is older
// than threshold_days; cards with NO collection are flagged only if they were
// opened more than threshold_days ago.
router.get('/no-collection', async (req, res, next) => {
  try {
    const { rows: settings } = await pool.query(
      `SELECT value FROM settings WHERE key = 'alert_days_global'`
    );
    const parsed = Number.parseInt(settings[0]?.value, 10);
    const globalDays = Number.isInteger(parsed) && parsed > 0 ? parsed : 30;

    const params = [globalDays];
    let collectorClause = '';
    if (req.user.role === 'collector') {
      const { rows: userRows } = await pool.query(
        `SELECT area_assignments, area_exclusions FROM users WHERE id=$1 AND active=TRUE`,
        [req.user.id]
      );
      if (!userRows[0]) return res.json({ global_threshold: globalDays, count: 0, items: [] });
      const incClause = buildLocationClause(userRows[0].area_assignments || [], params);
      if (!incClause) return res.json({ global_threshold: globalDays, count: 0, items: [] });
      collectorClause = ` AND ${incClause}`;
      const excClause = buildLocationClause(userRows[0].area_exclusions || [], params);
      if (excClause) collectorClause += ` AND NOT ${excClause}`;
    }

    // last_collection per card = MAX over union of envelope collections
    // and manual 'collection' events (so admin-created manual collection
    // events also close the alert window without forcing an empty envelope).
    const sql = `
      WITH last_collections AS (
        SELECT card_id, MAX(ts) AS last_collection
          FROM (
            SELECT card_id, collected_at AS ts FROM envelopes
            UNION ALL
            SELECT card_id, created_at   AS ts FROM events WHERE event_type = 'collection'
          ) src
         GROUP BY card_id
      )
      SELECT
        c.id AS card_id,
        c.box_id,
        b.iron_number,
        c.city, c.neighborhood, c.street, c.building, c.custom_name,
        rc.id   AS collector_id,
        rc.name AS collector_name,
        c.alert_days_personal,
        COALESCE(c.alert_days_personal, $1) AS threshold_days,
        c.opened_at,
        lc.last_collection,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(lc.last_collection, c.opened_at))) / 86400)::INTEGER
          AS days_since
      FROM cards c
      JOIN boxes b ON b.id = c.box_id
      ${RESOLVED_COLLECTOR_LATERAL}
      LEFT JOIN last_collections lc ON lc.card_id = c.id
      WHERE c.status = 'active'
        ${collectorClause}
        AND (
          (lc.last_collection IS NOT NULL
              AND NOW() - lc.last_collection
                  > make_interval(days => COALESCE(c.alert_days_personal, $1)))
          OR
          (lc.last_collection IS NULL
              AND NOW() - c.opened_at
                  > make_interval(days => COALESCE(c.alert_days_personal, $1)))
        )
      ORDER BY days_since DESC NULLS LAST`;

    const { rows } = await pool.query(sql, params);
    res.json({ global_threshold: globalDays, count: rows.length, items: rows });
  } catch (err) { next(err); }
});

module.exports = router;
