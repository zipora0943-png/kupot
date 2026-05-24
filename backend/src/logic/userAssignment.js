const pool = require('../db/pool');

/**
 * Two rule shapes are accepted (both flavors live in production data):
 *
 *   1) Tagged shape (used by seed scripts and earlier tests):
 *      { type: 'district',     value: 'דרום' }
 *      { type: 'city',         value: 'בני ברק' }
 *      { type: 'neighborhood', city: 'בני ברק', value: 'רמת אלחנן' }
 *      { type: 'street',       city: '...', neighborhood: '...', value: 'חזון איש' }
 *      { type: 'box',          box_id: 42 }
 *
 *   2) Partial-key shape (created by the admin UI / UserModal):
 *      { district: 'דרום' }
 *      { city: 'בני ברק' }
 *      { city: 'בני ברק', neighborhood: 'רמת אלחנן' }
 *      { city: '...', neighborhood: '...', street: 'חזון איש' }
 *      { box_id: 42 }
 *
 *   Any rule may additionally include `box_type_id` (integer) to restrict the
 *   rule to boxes of a specific type. It can also stand alone as
 *   { box_type_id: 5 } — applies to every box of that type regardless of
 *   location.
 *
 * Hierarchy specificity (highest wins, integer scoring):
 *   box (9) > street (7) > neighborhood (5) > city (3) > district (1)
 *   Adding box_type_id to a rule adds +1 to its score (so e.g. "city + box_type"
 *   beats plain city but loses to neighborhood — narrowing by location dominates).
 *   A box_type-only rule scores 1 (same as district — least specific).
 *
 * District matching depends on the `cities` table: a district rule matches a
 * card iff the card's city.name is present in `cities` with that district
 * value. Cities not in the table are unreachable through district rules
 * (the admin gets a warning in the settings page).
 */

// ─── helpers: detect shape and extract scalar fields the rule pins down ──
function ruleHasField(rule, key) {
  return rule && Object.prototype.hasOwnProperty.call(rule, key) && rule[key] != null && rule[key] !== '';
}

function isTagged(rule) {
  return rule && typeof rule === 'object' && typeof rule.type === 'string';
}

// Returns the rule normalized as
//   { district?, city?, neighborhood?, street?, building?, box_id?, box_type_id? }.
// Tagged-shape rules are converted; partial-key rules are returned as-is.
// Returns null if the rule yields no constraints.
function normalizeRule(rule) {
  if (!rule || typeof rule !== 'object') return null;

  // box_type_id can attach to any shape; collect it once.
  let boxTypeId = null;
  if (ruleHasField(rule, 'box_type_id')) {
    const n = Number(rule.box_type_id);
    if (Number.isInteger(n)) boxTypeId = n;
  }

  if (isTagged(rule)) {
    let out = null;
    switch (rule.type) {
      case 'district':
        if (rule.value) out = { district: rule.value };
        break;
      case 'city':
        if (rule.value) out = { city: rule.value };
        break;
      case 'neighborhood':
        if (rule.city && rule.value) out = { city: rule.city, neighborhood: rule.value };
        break;
      case 'street':
        if (rule.city && rule.neighborhood && rule.value)
          out = { city: rule.city, neighborhood: rule.neighborhood, street: rule.value };
        break;
      case 'box': {
        const n = Number(rule.box_id);
        if (Number.isInteger(n)) out = { box_id: n };
        break;
      }
    }
    if (!out && boxTypeId == null) return null;
    if (!out) out = {};
    if (boxTypeId != null) out.box_type_id = boxTypeId;
    return out;
  }

  // Partial-key shape
  const out = {};
  if (ruleHasField(rule, 'district'))     out.district     = rule.district;
  if (ruleHasField(rule, 'city'))         out.city         = rule.city;
  if (ruleHasField(rule, 'neighborhood')) out.neighborhood = rule.neighborhood;
  if (ruleHasField(rule, 'street'))       out.street       = rule.street;
  if (ruleHasField(rule, 'building'))     out.building     = rule.building;
  if (ruleHasField(rule, 'box_id')) {
    const n = Number(rule.box_id);
    if (Number.isInteger(n)) out.box_id = n;
  }
  if (boxTypeId != null) out.box_type_id = boxTypeId;
  return Object.keys(out).length === 0 ? null : out;
}

// Specificity score for a normalized rule. Higher = more specific.
// Base scores leave room for the +1 box_type_id refinement without ever
// surpassing the next location tier: e.g. "city + box_type" (4) < "neighborhood" (5).
function ruleScore(norm) {
  if (!norm) return 0;
  let base;
  if (norm.box_id != null)        base = 9;
  else if (norm.street)           base = 7;
  else if (norm.building)         base = 7; // treat as street level
  else if (norm.neighborhood)     base = 5;
  else if (norm.city)             base = 3;
  else if (norm.district)         base = 1;
  else                            base = 0;
  // A box_type-only rule (no location at all) still counts as specificity 1.
  if (base === 0 && norm.box_type_id != null) return 1;
  return base + (norm.box_type_id != null ? 1 : 0);
}

// ─── Build a SQL WHERE fragment from a list of rules.
// `params` is mutated (push values for parameter binding).
// Returns the SQL fragment, or null if no valid rules.
//
// Outer query is expected to alias the boxes table as `b` and cards table
// as `c`. District rules expand to a subquery against the `cities` table.
function buildLocationClause(rules, params) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const orParts = [];
  for (const rule of rules) {
    const norm = normalizeRule(rule);
    if (!norm) continue;
    const andParts = [];
    if (norm.box_id != null) {
      params.push(norm.box_id);
      andParts.push(`b.id = $${params.length}`);
    } else {
      if (norm.district) {
        params.push(norm.district);
        andParts.push(
          `EXISTS (SELECT 1 FROM cities ci WHERE ci.name = c.city AND ci.district = $${params.length})`
        );
      }
      if (norm.city)         { params.push(norm.city);         andParts.push(`c.city = $${params.length}`); }
      if (norm.neighborhood) { params.push(norm.neighborhood); andParts.push(`c.neighborhood = $${params.length}`); }
      if (norm.street)       { params.push(norm.street);       andParts.push(`c.street = $${params.length}`); }
      if (norm.building)     { params.push(norm.building);     andParts.push(`c.building = $${params.length}`); }
    }
    if (norm.box_type_id != null) {
      params.push(norm.box_type_id);
      andParts.push(`b.box_type_id = $${params.length}`);
    }
    if (andParts.length > 0) orParts.push('(' + andParts.join(' AND ') + ')');
  }
  return orParts.length > 0 ? '(' + orParts.join(' OR ') + ')' : null;
}

/**
 * SQL fragment matching boxes with an open/in-progress task whose type has
 * `grants_temporary_access = TRUE`, assigned to the user bound at $userIdParam.
 * Used as an OR-branch alongside the area-rule clause so collectors see boxes
 * they are temporarily authorised to collect from. Outer query must alias the
 * boxes table as `b`.
 */
function temporaryAccessClause(userIdParamIndex) {
  return `EXISTS (
    SELECT 1 FROM tasks tg
      JOIN task_types ttg ON ttg.id = tg.task_type_id
     WHERE tg.box_id = b.id
       AND tg.assigned_to = $${userIdParamIndex}
       AND tg.status IN ('open','in_progress')
       AND ttg.grants_temporary_access = TRUE
  )`;
}

/**
 * Returns active cards visible to a collector, filtered at the DB level.
 * Empty result if the user is missing or deactivated.
 *
 * Visibility = area-rule match OR active collection task (grants_temporary_access).
 */
async function getBoxesForCollector(userId) {
  const { rows: userRows } = await pool.query(
    `SELECT area_assignments, area_exclusions, active FROM users WHERE id = $1`,
    [userId]
  );
  if (!userRows[0] || !userRows[0].active) return [];

  const assignments = userRows[0].area_assignments || [];
  const exclusions  = userRows[0].area_exclusions  || [];

  const params = [];
  const incClause = buildLocationClause(assignments, params);
  const excClause = buildLocationClause(exclusions, params);

  // Build the area-based branch. Empty assignments → area branch is unsatisfiable.
  const areaBranch = incClause
    ? (excClause ? `(${incClause} AND NOT ${excClause})` : incClause)
    : 'FALSE';

  // Append userId param for the temporary-access branch.
  params.push(userId);
  const tempBranch = temporaryAccessClause(params.length);

  const sql = `
    SELECT b.id  AS box_id, b.iron_number, b.status AS box_status,
           c.id  AS card_id, c.city, c.neighborhood, c.street, c.building,
           c.custom_name, c.collector_id
    FROM boxes b
    JOIN cards c ON c.box_id = b.id AND c.status = 'active'
    WHERE b.status = 'active'
      AND (${areaBranch} OR ${tempBranch})
    ORDER BY c.city, c.neighborhood, c.street, b.id`;

  const { rows } = await pool.query(sql, params);
  return rows;
}

/**
 * Permission helper: is a given box visible to a given collector?
 */
async function isBoxAssignedToCollector(boxId, userId) {
  const cards = await getBoxesForCollector(userId);
  return cards.some(c => Number(c.box_id) === Number(boxId));
}

/**
 * Permission helper: is a given card visible to a given collector?
 */
async function isCardAssignedToCollector(cardId, userId) {
  const { rows } = await pool.query(`SELECT box_id FROM cards WHERE id = $1`, [cardId]);
  if (!rows[0]) return false;
  return isBoxAssignedToCollector(rows[0].box_id, userId);
}

// ─── Pure JS helpers — kept for tests and client-side validation.
//
// `card` may include `box_type_id` (when matching by box type) and
// `cityDistrict` (the resolved district for the card's city, used to match
// district rules). Both are optional — when absent, the corresponding rule
// constraints simply fail.
function matchesRule(card, rule) {
  if (!card) return false;
  const norm = normalizeRule(rule);
  if (!norm) return false;
  if (norm.box_id != null) {
    if (Number(card.box_id) !== Number(norm.box_id)) return false;
  } else {
    if (norm.district     && card.cityDistrict !== norm.district)    return false;
    if (norm.city         && card.city         !== norm.city)        return false;
    if (norm.neighborhood && card.neighborhood !== norm.neighborhood) return false;
    if (norm.street       && card.street       !== norm.street)      return false;
    if (norm.building     && card.building     !== norm.building)    return false;
  }
  if (norm.box_type_id != null && Number(card.box_type_id) !== Number(norm.box_type_id)) return false;
  return true;
}

function matchesAny(card, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return false;
  return rules.some(rule => matchesRule(card, rule));
}

// Returns the highest specificity score among rules that match the card,
// or 0 if none match.
function bestMatchSpecificity(card, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return 0;
  let best = 0;
  for (const rule of rules) {
    if (!matchesRule(card, rule)) continue;
    const score = ruleScore(normalizeRule(rule));
    if (score > best) best = score;
  }
  return best;
}

/**
 * Resolve the collector that should own a card at a given location, by
 * walking the user hierarchy: box > street > neighborhood > city.
 *
 * Considers only active collectors. A collector is skipped if any of their
 * exclusion rules matches the location. Among the rest, the user with the
 * most specific matching assignment wins (lowest user id breaks ties).
 *
 * Returns the collector id, or null if no collector matches.
 */
async function findCollectorForLocation(location, client) {
  if (!location) return null;
  const card = {
    box_id:       location.box_id,
    box_type_id:  location.box_type_id,
    city:         location.city,
    neighborhood: location.neighborhood,
    street:       location.street,
    building:     location.building,
  };
  if (card.box_id == null && !card.city) return null;

  const db = client || pool;

  // Resolve box_type_id from the box if the caller didn't supply it but a box_id
  // is present — so rules that filter by box_type_id can match correctly.
  if (card.box_type_id == null && card.box_id != null) {
    const { rows } = await db.query(`SELECT box_type_id FROM boxes WHERE id = $1`, [card.box_id]);
    if (rows[0]) card.box_type_id = rows[0].box_type_id;
  }

  // Resolve the card's district from the cities table so that district rules
  // can match by comparing against card.cityDistrict.
  if (card.city) {
    const { rows } = await db.query(`SELECT district FROM cities WHERE name = $1`, [card.city]);
    card.cityDistrict = rows[0]?.district || null;
  }

  const { rows: collectors } = await db.query(
    `SELECT id, area_assignments, area_exclusions
       FROM users
      WHERE role = 'collector' AND active = TRUE
      ORDER BY id ASC`
  );

  let best = null;
  for (const u of collectors) {
    const assignments = u.area_assignments || [];
    const exclusions  = u.area_exclusions  || [];
    if (matchesAny(card, exclusions)) continue;
    const score = bestMatchSpecificity(card, assignments);
    if (score === 0) continue;
    if (!best || score > best.score) best = { id: u.id, score };
  }
  return best ? best.id : null;
}

// ─── SQL match predicates ───────────────────────────────────────────────
// A rule (`r`) inside jsonb_array_elements matches the card iff:
//   • box rule       — r->>'box_id' is a positive integer that equals c.box_id
//   • tagged rule    — r->>'type' identifies one of district/city/neighborhood/street
//                      and r->>'value' (plus the upstream keys) equal the card
//   • partial-key    — every present location key (district/city/neighborhood/
//                      street/building) equals the corresponding card column;
//                      at least one must be present OR `box_type_id` must be set
//   • box_type_id (if present in the rule) must equal b.box_type_id
//
// District matching resolves the card's city against the `cities` table:
// the rule matches iff a row exists in cities with name = c.city and district
// = the rule's district value.
//
// Used inside the LATERAL below; `c` refers to the outer card row, `b` to
// the outer boxes row (every caller joins boxes b ON b.id = c.box_id).
const RULE_MATCHES_CARD = `(
  -- Per-rule location predicate
  (
    (
      (r ? 'box_id') AND (r->>'box_id') ~ '^[0-9]+$' AND (r->>'box_id')::int = c.box_id
    )
    OR
    (
      (r ? 'type') AND (
           (r->>'type' = 'district'     AND EXISTS (SELECT 1 FROM cities ci WHERE ci.name = c.city AND ci.district = r->>'value'))
        OR (r->>'type' = 'city'         AND r->>'value' = c.city)
        OR (r->>'type' = 'neighborhood' AND r->>'city' = c.city AND r->>'value' = c.neighborhood)
        OR (r->>'type' = 'street'       AND r->>'city' = c.city AND r->>'neighborhood' = c.neighborhood AND r->>'value' = c.street)
      )
    )
    OR
    (
      NOT (r ? 'type') AND NOT (r ? 'box_id')
      AND ((r ? 'district') OR (r ? 'city') OR (r ? 'neighborhood') OR (r ? 'street') OR (r ? 'building'))
      AND (NOT (r ? 'district')     OR EXISTS (SELECT 1 FROM cities ci WHERE ci.name = c.city AND ci.district = r->>'district'))
      AND (NOT (r ? 'city')         OR r->>'city'         = c.city)
      AND (NOT (r ? 'neighborhood') OR r->>'neighborhood' = c.neighborhood)
      AND (NOT (r ? 'street')       OR r->>'street'       = c.street)
      AND (NOT (r ? 'building')     OR r->>'building'     = c.building)
    )
    OR
    (
      -- box_type-only rule (no location): qualifies any box of that type
      NOT (r ? 'type') AND NOT (r ? 'box_id')
      AND NOT ((r ? 'district') OR (r ? 'city') OR (r ? 'neighborhood') OR (r ? 'street') OR (r ? 'building'))
      AND (r ? 'box_type_id') AND (r->>'box_type_id') ~ '^[0-9]+$'
    )
  )
  -- box_type_id refinement (applies on top of the location predicate)
  AND (
    NOT (r ? 'box_type_id') OR (
      (r->>'box_type_id') ~ '^[0-9]+$'
      AND (r->>'box_type_id')::int = b.box_type_id
    )
  )
)`;

// Specificity score for a single rule element `r` (used in ORDER BY).
// Must mirror the JS ruleScore() function in this file.
const RULE_SCORE_SQL = `(
  (CASE
    WHEN (r ? 'box_id') THEN 9
    WHEN (r ? 'type') THEN
      CASE r->>'type'
        WHEN 'box'          THEN 9
        WHEN 'street'       THEN 7
        WHEN 'neighborhood' THEN 5
        WHEN 'city'         THEN 3
        WHEN 'district'     THEN 1
        ELSE 0
      END
    WHEN (r ? 'street')       THEN 7
    WHEN (r ? 'building')     THEN 7
    WHEN (r ? 'neighborhood') THEN 5
    WHEN (r ? 'city')         THEN 3
    WHEN (r ? 'district')     THEN 1
    ELSE 0
  END)
  + (CASE WHEN (r ? 'box_type_id') THEN 1 ELSE 0 END)
)`;

/**
 * SQL fragment: LATERAL subquery that resolves the collector for each card
 * by walking the user-assignment hierarchy (box > street > neighborhood > city).
 *
 * Supports both rule shapes (tagged and partial-key) — see top of file.
 *
 * Expects the outer query to alias the cards table as `c` and to expose
 * c.city, c.neighborhood, c.street, c.building, c.box_id. Yields:
 *   rc.id   — resolved collector id   (or NULL)
 *   rc.name — resolved collector name (or NULL)
 */
const RESOLVED_COLLECTOR_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT u.id, u.name
      FROM users u
     WHERE u.role = 'collector' AND u.active = TRUE
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(u.area_assignments) r
          WHERE ${RULE_MATCHES_CARD}
       )
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(u.area_exclusions) r
          WHERE ${RULE_MATCHES_CARD}
       )
     ORDER BY (
       SELECT MAX(${RULE_SCORE_SQL})
         FROM jsonb_array_elements(u.area_assignments) r
        WHERE ${RULE_MATCHES_CARD}
     ) DESC NULLS LAST, u.id ASC
     LIMIT 1
  ) rc ON TRUE
`;

/**
 * SQL fragment: LATERAL subquery that resolves ALL collectors whose rules
 * match each card (multi-assignment, "כפילויות"). A collector is included iff
 * at least one of their `area_assignments` matches the card AND none of their
 * `area_exclusions` match. Specificity is intentionally NOT used to break
 * ties — every qualifying collector is returned, ordered by user id.
 *
 * Expects the outer query to alias the cards table as `c` (with c.city,
 * c.neighborhood, c.street, c.building, c.box_id). Yields:
 *   rc.ids       — int[]  of collector ids   (empty array if none)
 *   rc.names_arr — text[] of collector names (parallel to ids)
 *   rc.names     — text   "name1, name2"     (NULL if none)
 */
const RESOLVED_COLLECTORS_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(array_agg(u.id   ORDER BY u.id), ARRAY[]::int[])  AS ids,
      COALESCE(array_agg(u.name ORDER BY u.id), ARRAY[]::text[]) AS names_arr,
      string_agg(u.name, ', ' ORDER BY u.id)                      AS names
      FROM users u
     WHERE u.role = 'collector' AND u.active = TRUE
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(u.area_assignments) r
          WHERE ${RULE_MATCHES_CARD}
       )
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(u.area_exclusions) r
          WHERE ${RULE_MATCHES_CARD}
       )
  ) rc ON TRUE
`;

module.exports = {
  getBoxesForCollector,
  isBoxAssignedToCollector,
  isCardAssignedToCollector,
  matchesRule,
  matchesAny,
  bestMatchSpecificity,
  buildLocationClause,
  temporaryAccessClause,
  findCollectorForLocation,
  normalizeRule,
  RESOLVED_COLLECTOR_LATERAL,
  RESOLVED_COLLECTORS_LATERAL,
};
