const pool = require('../db/pool');

// Google Maps Geocoding API.
// The API key is read from the settings table (key: `google_maps_api_key`) —
// configured by an admin through the SettingsPage UI, never via .env.
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

async function getApiKey() {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE key = 'google_maps_api_key' LIMIT 1`
    );
    const v = rows[0]?.value;
    return typeof v === 'string' && v.trim() ? v.trim() : '';
  } catch {
    return '';
  }
}

// Build the free-text `address` portion. The CITY is intentionally omitted
// here — it is enforced through the `components` filter so Google never spills
// over to a same-named street in a neighbouring city.
function buildAddressQuery({ neighborhood, street, building }) {
  const parts = [building, street, neighborhood]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.join(', ');
}

// Loose comparison for Hebrew city names: ignore whitespace, hyphens, quotes
// and apostrophes. "תל אביב-יפו" should match "תל אביב יפו" / "תל-אביב".
function normalizeCityName(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/[\s\-'"׳״]/g, '')
    .toLowerCase()
    .trim();
}

function localityMatches(addressComponents, inputCity) {
  if (!Array.isArray(addressComponents) || !inputCity) return false;
  const target = normalizeCityName(inputCity);
  for (const c of addressComponents) {
    if (!Array.isArray(c.types)) continue;
    if (!c.types.includes('locality') && !c.types.includes('sublocality') &&
        !c.types.includes('administrative_area_level_2')) continue;
    const candidates = [c.long_name, c.short_name].filter(Boolean).map(normalizeCityName);
    for (const cand of candidates) {
      if (!cand) continue;
      if (cand === target) return true;
      // Tolerate "תל אביב" inside "תל אביב-יפו" and vice-versa.
      if (cand.includes(target) || target.includes(cand)) return true;
    }
  }
  return false;
}

async function geocodeAddress(address) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { status: 'disabled', lat: null, lng: null };
  }
  const city = (typeof address.city === 'string') ? address.city.trim() : '';
  if (!city) {
    // Without a city we can't enforce the locality filter, so we refuse to
    // geocode rather than risk picking the wrong city.
    return { status: 'not_found', lat: null, lng: null };
  }

  const addr = buildAddressQuery(address);
  // `components` is a HARD filter on Google's side — country:IL + locality:CITY
  // ensures the result must be inside that city. We additionally verify the
  // result on our side (see localityMatches) so we never accept a result from
  // a same-named street in another city.
  const components = `country:IL|locality:${city}`;
  const params = new URLSearchParams({
    components,
    region: 'il',
    language: 'he',
    key: apiKey,
  });
  if (addr) params.set('address', addr);
  const url = `${GOOGLE_GEOCODE_URL}?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { status: 'error', lat: null, lng: null };
    }
    const data = await res.json();
    if (data.status === 'OK' && Array.isArray(data.results) && data.results[0]) {
      const first = data.results[0];

      // Defence in depth — Google's components filter should already restrict
      // to the city, but we double-check the response just in case.
      if (!localityMatches(first.address_components, city)) {
        console.warn('[geocoding] result rejected — locality mismatch',
          { city, returned: first.formatted_address });
        return { status: 'not_found', lat: null, lng: null };
      }

      const loc = first.geometry?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return { status: 'ok', lat: loc.lat, lng: loc.lng };
      }
      return { status: 'error', lat: null, lng: null };
    }
    if (data.status === 'ZERO_RESULTS') {
      return { status: 'not_found', lat: null, lng: null };
    }
    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
      console.error('[geocoding] Google API error:', data.status, data.error_message || '');
      return { status: 'error', lat: null, lng: null };
    }
    return { status: 'error', lat: null, lng: null };
  } catch (err) {
    console.error('[geocoding] request failed', err.message);
    return { status: 'error', lat: null, lng: null };
  }
}

// Geocode a card and persist the result. Re-geocoding resets `geocode_approved`
// so an admin must visually re-confirm the new location on the map.
async function geocodeCard(cardId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, city, neighborhood, street, building FROM cards WHERE id = $1`,
      [cardId],
    );
    const card = rows[0];
    if (!card) return null;

    const result = await geocodeAddress({
      city: card.city,
      neighborhood: card.neighborhood,
      street: card.street,
      building: card.building,
    });

    await pool.query(
      `UPDATE cards
          SET latitude = $1,
              longitude = $2,
              geocoded_at = NOW(),
              geocode_status = $3,
              geocode_approved = FALSE,
              geocode_approved_by = NULL,
              geocode_approved_at = NULL
        WHERE id = $4`,
      [result.lat, result.lng, result.status, cardId],
    );
    return result;
  } catch (err) {
    console.error('[geocoding] geocodeCard failed for card', cardId, err.message);
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Batch-geocode every active card whose geocode_status is not 'ok'.
// Google does not require throttling like Nominatim, but we keep a small gap
// between requests to avoid hammering quotas. Returns counters.
async function geocodeMissingCards() {
  const { rows } = await pool.query(
    `SELECT id FROM cards
       WHERE status = 'active'
         AND (geocode_status IS NULL OR geocode_status <> 'ok')
       ORDER BY id`,
  );
  const stats = { attempted: 0, ok: 0, not_found: 0, error: 0, disabled: 0 };
  for (const { id } of rows) {
    const result = await geocodeCard(id);
    stats.attempted += 1;
    if (result) {
      if (result.status === 'ok')             stats.ok += 1;
      else if (result.status === 'not_found') stats.not_found += 1;
      else if (result.status === 'disabled')  stats.disabled += 1;
      else                                    stats.error += 1;
    } else {
      stats.error += 1;
    }
    if (stats.attempted < rows.length) await sleep(150);
  }
  return stats;
}

module.exports = {
  geocodeAddress,
  geocodeCard,
  geocodeMissingCards,
  buildAddressQuery,
  getApiKey,
  localityMatches, // exported for testing
};
