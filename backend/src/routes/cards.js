const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { openCard, closeCard, reopenCard, getActiveCard, EVENT } = require('../logic/cardLogic');
const {
  isCardAssignedToCollector, isBoxAssignedToCollector,
  buildLocationClause, temporaryAccessClause,
  RESOLVED_COLLECTORS_LATERAL,
} = require('../logic/userAssignment');
const { geocodeCard, geocodeMissingCards, retryCardWithStreet } = require('../services/geocoding');
const { haversineMeters } = require('../services/distance');

// Radius (meters) within which the collector is considered "at" the card location.
const LOCATION_RADIUS_METERS = 25;

// Fire-and-forget geocoding. We never await this from the request path because
// we don't want a slow/failing Google response to delay the API response.
function scheduleGeocode(cardId) {
  if (!Number.isInteger(cardId)) return;
  Promise.resolve().then(() => geocodeCard(cardId)).catch(() => {});
}

// Overlay each row's collector_id / collector_name with the resolved set of
// collectors from the LATERAL subquery (multi-assignment, "כפילויות"). All
// matching collectors are returned as parallel arrays; `collector_id` /
// `collector_name` keep singular shape (first matching collector) for any
// older callers, but the canonical fields going forward are the plural ones.
function applyResolvedCollector(row) {
  if (!row) return row;
  const ids   = Array.isArray(row.resolved_collector_ids)   ? row.resolved_collector_ids   : [];
  const names = Array.isArray(row.resolved_collector_names) ? row.resolved_collector_names : [];
  return {
    ...row,
    collector_id:    ids[0]   ?? null,
    collector_name:  row.resolved_collector_name ?? null,
    collector_ids:   ids,
    collector_names: names,
    resolved_collector_ids:   undefined,
    resolved_collector_names: undefined,
    resolved_collector_name:  undefined,
  };
}

router.use(authenticate);
// Task 36: cashroom users have no access to card data — only the cashroom workflow.
router.use(requireRole('admin', 'collector'));

const VALID_STATUSES = ['active', 'closed'];

// ─── helpers ──────────────────────────────────────────────────────
async function collectorCanSee(cardId, userId) {
  return isCardAssignedToCollector(cardId, userId);
}

// ─── routes ───────────────────────────────────────────────────────

// GET /api/cards  — with full filters
router.get('/', async (req, res, next) => {
  const { city, neighborhood, street, collector_id, status, custom_name, receipt_required, box_id } = req.query;

  let q = `SELECT c.*, b.iron_number, b.box_type_id, bt.name AS box_type_name,
                  rc.ids       AS resolved_collector_ids,
                  rc.names_arr AS resolved_collector_names,
                  rc.names     AS resolved_collector_name,
                  GREATEST(
                    (SELECT MAX(e.collected_at) FROM envelopes e WHERE e.card_id = c.id),
                    (SELECT MAX(ev.created_at)  FROM events    ev WHERE ev.card_id = c.id AND ev.event_type = 'collection')
                  ) AS last_collection_at,
                  EXISTS (SELECT 1 FROM reports r WHERE r.card_id = c.id AND r.status = 'open')        AS has_open_report,
                  EXISTS (SELECT 1 FROM tasks   t WHERE t.card_id = c.id AND t.status IN ('open','in_progress')) AS has_open_task
             FROM cards c
             JOIN boxes b ON b.id = c.box_id
             LEFT JOIN box_types bt ON bt.id = b.box_type_id
             ${RESOLVED_COLLECTORS_LATERAL}
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
    p.push(cid); q += ` AND $${p.length} = ANY(rc.ids)`;
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

// POST /api/cards/geocode-missing  — admin: batch-geocode every card whose
// geocode_status is NULL or anything other than 'ok'. Throttled internally
// (~1 req/sec) to respect the Nominatim usage policy.
// Successful results are auto-approved (attributed to the running admin) —
// the response includes the list of cards still stuck at 'not_found' so the
// admin can pin them manually on the map.
// Registered before any '/:id/...' route so the literal path matches first.
router.post('/geocode-missing', requireRole('admin'), async (req, res, next) => {
  try {
    const rawCity = req.body?.city;
    const city = (typeof rawCity === 'string' && rawCity.trim()) ? rawCity.trim() : null;
    const stats = await geocodeMissingCards({
      autoApprove: true,
      userId: req.user.id,
      city,
    });
    res.json(stats);
  } catch (err) { next(err); }
});

// GET /api/cards/geocode-pending  — admin: list active cards that still need
// a geocode attempt. By default we skip cards that already settled on 'ok'
// (success — nothing to do) and 'not_found' (Google already said no — retrying
// the same address won't help; the admin is expected to fix the address, use
// the street-rename feature, or pin manually). Cards stuck at 'error' or
// 'disabled' (transient: network glitch, missing API key) are still picked up
// so they auto-recover once the underlying issue is fixed.
//
// Optional `?city=` scopes to that city.
// Optional `?includeNotFound=1` brings back the sticky 'not_found' cards too —
// used by the "retry not-found cards" button in the SettingsPage.
router.get('/geocode-pending', requireRole('admin'), async (req, res, next) => {
  const rawCity = req.query?.city;
  const city = (typeof rawCity === 'string' && rawCity.trim()) ? rawCity.trim() : null;
  const includeNotFound = req.query?.includeNotFound === '1' || req.query?.includeNotFound === 'true';
  const params = [];
  let sql = `SELECT c.id, c.city, c.neighborhood, c.street, c.building, c.custom_name,
                    b.iron_number
               FROM cards c
               JOIN boxes b ON b.id = c.box_id
              WHERE c.status = 'active'
                AND (c.geocode_status IS NULL OR c.geocode_status <> 'ok')`;
  if (!includeNotFound) {
    sql += ` AND (c.geocode_status IS NULL OR c.geocode_status <> 'not_found')`;
  }
  if (city) {
    params.push(city);
    sql += ` AND lower(btrim(c.city)) = lower(btrim($${params.length}))`;
  }
  sql += ` ORDER BY c.id`;
  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/cards/geocode-not-found  — admin: list active cards currently stuck
// at `geocode_status = 'not_found'` (so the SettingsPage can group them by
// street for bulk rename, including cards from previous runs that are still
// sitting in the backlog). Optional `?city=` scopes to that city.
router.get('/geocode-not-found', requireRole('admin'), async (req, res, next) => {
  const rawCity = req.query?.city;
  const city = (typeof rawCity === 'string' && rawCity.trim()) ? rawCity.trim() : null;
  const params = [];
  let sql = `SELECT c.id, c.city, c.neighborhood, c.street, c.building, c.custom_name,
                    b.iron_number
               FROM cards c
               JOIN boxes b ON b.id = c.box_id
              WHERE c.status = 'active'
                AND c.geocode_status = 'not_found'`;
  if (city) {
    params.push(city);
    sql += ` AND lower(btrim(c.city)) = lower(btrim($${params.length}))`;
  }
  sql += ` ORDER BY c.city, c.street, b.iron_number`;
  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/cards/retry-street-rename  — admin: re-geocode a list of cards with
// an overridden street name. For each card where Google returns a hit, persist
// the new street + coords + auto-approve. Cards where Google still doesn't find
// the address are left untouched (the response includes `returned_address` so
// the UI can show what Google was offering).
// Body: { cardIds: number[], newStreet: string }
// Capped at 200 cards per call so the request can't run for minutes.
router.post('/retry-street-rename', requireRole('admin'), async (req, res, next) => {
  const { cardIds, newStreet } = req.body || {};
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return res.status(400).json({ error: 'cardIds must be a non-empty array' });
  }
  if (cardIds.length > 200) {
    return res.status(400).json({ error: 'too many cards in one call (max 200)' });
  }
  const ids = cardIds.map(Number).filter(Number.isInteger);
  if (ids.length === 0) {
    return res.status(400).json({ error: 'cardIds must contain integers' });
  }
  if (typeof newStreet !== 'string' || !newStreet.trim()) {
    return res.status(400).json({ error: 'newStreet is required' });
  }
  try {
    const results = [];
    for (const id of ids) {
      const r = await retryCardWithStreet(id, newStreet, { userId: req.user.id });
      results.push(r);
    }
    const summary = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    res.json({ summary, results });
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

// GET /api/cards/lookup-by-iron/:iron_number
// Resolve a box by its iron_number to the active card, with distinct error
// states for the collector flow (manual box-number entry):
//   404 'box_not_found' — no box has that iron_number
//   403 'not_assigned'  — active card exists but is not visible to this collector
//   409 'card_closed'   — box exists but has no active card
//   200 + card row      — happy path
// Registered before GET /:id so the literal path is matched first.
router.get('/lookup-by-iron/:iron_number', async (req, res, next) => {
  const iron = String(req.params.iron_number || '').trim();
  if (!iron) return res.status(400).json({ error: 'iron_number required' });

  try {
    const { rows: boxRows } = await pool.query(
      `SELECT id FROM boxes WHERE iron_number = $1`,
      [iron]
    );
    if (!boxRows[0]) return res.status(404).json({ error: 'box_not_found' });
    const boxId = boxRows[0].id;

    const { rows: activeRows } = await pool.query(
      `SELECT c.*, b.iron_number, b.status AS box_status,
              rc.ids       AS resolved_collector_ids,
              rc.names_arr AS resolved_collector_names,
              rc.names     AS resolved_collector_name
         FROM cards c
         JOIN boxes b ON b.id = c.box_id
         ${RESOLVED_COLLECTORS_LATERAL}
        WHERE c.box_id = $1 AND c.status = 'active'
        LIMIT 1`,
      [boxId]
    );

    if (!activeRows[0]) return res.status(409).json({ error: 'card_closed' });

    if (req.user.role === 'collector') {
      const allowed = await isBoxAssignedToCollector(boxId, req.user.id);
      if (!allowed) return res.status(403).json({ error: 'not_assigned' });
    }

    res.json(applyResolvedCollector(activeRows[0]));
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
              rc.ids       AS resolved_collector_ids,
              rc.names_arr AS resolved_collector_names,
              rc.names     AS resolved_collector_name,
              GREATEST(
                (SELECT MAX(e.collected_at) FROM envelopes e WHERE e.card_id = c.id),
                (SELECT MAX(ev.created_at)  FROM events    ev WHERE ev.card_id = c.id AND ev.event_type = 'collection')
              ) AS last_collection_at
         FROM cards c
         JOIN boxes b ON b.id = c.box_id
         LEFT JOIN box_types bt ON bt.id = b.box_type_id
         ${RESOLVED_COLLECTORS_LATERAL}
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
          receipt_required, receipt_details, installation_type } = req.body || {};

  const bid = Number(box_id);
  if (!Number.isInteger(bid)) return res.status(400).json({ error: 'box_id required' });
  if (installation_type !== undefined && installation_type !== null
      && typeof installation_type !== 'string') {
    return res.status(400).json({ error: 'installation_type must be string or null' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const card = await openCard(
      bid,
      { city, neighborhood, street, building, location_notes,
        collector_id, custom_name, alert_days_personal,
        receipt_required, receipt_details, installation_type },
      req.user.id,
      client,
      EVENT.INSTALLATION,
    );
    await client.query('COMMIT');
    scheduleGeocode(card.id);
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
    'installation_type',
  ];
  const addressFields = new Set(['city', 'neighborhood', 'street', 'building']);
  const sets = [];
  const params = [];
  let addressChanged = false;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      let value = req.body[key];
      if (key === 'installation_type') {
        if (value === '' || value === undefined) value = null;
        else if (value !== null && typeof value !== 'string') {
          return res.status(400).json({ error: 'installation_type must be string or null' });
        }
      }
      params.push(value);
      sets.push(`${key} = $${params.length}`);
      if (addressFields.has(key)) addressChanged = true;
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
    if (addressChanged) scheduleGeocode(rows[0].id);
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
      `SELECT c.*, b.iron_number,
              rc.ids       AS resolved_collector_ids,
              rc.names_arr AS resolved_collector_names,
              rc.names     AS resolved_collector_name
         FROM cards c
         JOIN boxes b ON b.id = c.box_id
         ${RESOLVED_COLLECTORS_LATERAL}
        WHERE c.box_id = $1 ORDER BY c.opened_at`,
      [card[0].box_id]
    );
    res.json(rows.map(applyResolvedCollector));
  } catch (err) { next(err); }
});

// POST /api/cards/:id/geocode  — admin: force re-geocode of a card's address.
// Useful after a manual address fix when the auto-trigger missed (or to retry
// after the GOOGLE_MAPS_API_KEY was added / Google API recovered).
router.post('/:id/geocode', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  // When the SettingsPage drives the batch loop, it passes `?autoApprove=1` so a
  // successful result is also marked approved (attributed to the running admin),
  // matching the server-side batch behaviour.
  const autoApprove = req.query?.autoApprove === '1' || req.query?.autoApprove === 'true';
  try {
    const { rows } = await pool.query(`SELECT id FROM cards WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const result = await geocodeCard(id, { autoApprove, userId: req.user.id });
    if (!result) return res.status(500).json({ error: 'Geocoding failed' });
    res.json({
      status: result.status,
      latitude: result.lat,
      longitude: result.lng,
    });
  } catch (err) { next(err); }
});

// POST /api/cards/:id/approve-geocode  — admin: mark the stored coordinates
// as visually confirmed on the map. Resets to FALSE automatically whenever
// the card is re-geocoded.
//
// Optional body: { lat, lng } — when supplied (after dragging the marker)
// the coordinates are overwritten before approval. This lets the admin fix
// small geocoder offsets or pin the location manually when the geocoder
// returned `not_found` / `error`.
router.post('/:id/approve-geocode', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { lat, lng } = req.body || {};
  const hasManualCoords = (lat !== undefined && lat !== null) || (lng !== undefined && lng !== null);
  if (hasManualCoords) {
    if (typeof lat !== 'number' || typeof lng !== 'number' ||
        Number.isNaN(lat) || Number.isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'lat/lng must be numeric and within valid range' });
    }
  }

  try {
    let rows;
    if (hasManualCoords) {
      ({ rows } = await pool.query(
        `UPDATE cards
            SET latitude = $1,
                longitude = $2,
                geocoded_at = NOW(),
                geocode_status = 'ok',
                geocode_approved = TRUE,
                geocode_approved_by = $3,
                geocode_approved_at = NOW()
          WHERE id = $4
          RETURNING id, latitude, longitude, geocode_status,
                    geocode_approved, geocode_approved_at`,
        [lat, lng, req.user.id, id],
      ));
    } else {
      ({ rows } = await pool.query(
        `UPDATE cards
            SET geocode_approved = TRUE,
                geocode_approved_by = $1,
                geocode_approved_at = NOW()
          WHERE id = $2
            AND geocode_status = 'ok'
          RETURNING id, latitude, longitude, geocode_status,
                    geocode_approved, geocode_approved_at`,
        [req.user.id, id],
      ));
    }
    if (!rows[0]) return res.status(409).json({ error: 'Card has no successful geocode to approve' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/cards/:id/verify-location
// Body: { lat: number, lng: number } — the device's current GPS coordinates.
// Response: { within_radius, distance_meters, radius_meters, card_geocoded }
//   - card_geocoded=false → card has no stored coords (caller should fall through).
//   - within_radius=true  → distance <= LOCATION_RADIUS_METERS.
// Note: latitude/longitude of the card are intentionally NOT returned, to avoid
// leaking the box's exact location to the client.
router.post('/:id/verify-location', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const { lat, lng } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number' ||
      Number.isNaN(lat) || Number.isNaN(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng required (numeric, valid range)' });
  }

  try {
    if (req.user.role === 'collector' && !(await collectorCanSee(id, req.user.id))) {
      return res.status(403).json({ error: 'Card not assigned to this collector' });
    }
    const { rows } = await pool.query(
      `SELECT latitude, longitude, geocode_status FROM cards WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    const card = rows[0];
    const hasCoords =
      card.geocode_status === 'ok' &&
      card.latitude != null && card.longitude != null;
    if (!hasCoords) {
      return res.json({
        card_geocoded: false,
        within_radius: true,
        distance_meters: null,
        radius_meters: LOCATION_RADIUS_METERS,
      });
    }

    const distance = haversineMeters(
      Number(card.latitude), Number(card.longitude),
      lat, lng,
    );
    const distanceRounded = Math.round(distance);
    res.json({
      card_geocoded: true,
      within_radius: distance <= LOCATION_RADIUS_METERS,
      distance_meters: distanceRounded,
      radius_meters: LOCATION_RADIUS_METERS,
    });
  } catch (err) { next(err); }
});

module.exports = router;
