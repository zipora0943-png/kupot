const pool = require('../db/pool');

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function buildAddressQuery({ city, neighborhood, street, building }) {
  const parts = [building, street, neighborhood, city]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.join(', ') + ', Israel';
}

async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { status: 'disabled', lat: null, lng: null };
  }
  const query = buildAddressQuery(address);
  if (!query) {
    return { status: 'not_found', lat: null, lng: null };
  }

  const url = `${GOOGLE_GEOCODE_URL}?address=${encodeURIComponent(query)}&region=il&language=he&key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { status: 'error', lat: null, lng: null };
    }
    const data = await res.json();
    if (data.status === 'OK' && Array.isArray(data.results) && data.results[0]) {
      const loc = data.results[0].geometry?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return { status: 'ok', lat: loc.lat, lng: loc.lng };
      }
      return { status: 'error', lat: null, lng: null };
    }
    if (data.status === 'ZERO_RESULTS') {
      return { status: 'not_found', lat: null, lng: null };
    }
    return { status: 'error', lat: null, lng: null };
  } catch (err) {
    console.error('[geocoding] request failed', err.message);
    return { status: 'error', lat: null, lng: null };
  }
}

// Geocode a card and persist the result. Fire-and-forget friendly: never throws.
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
              geocode_status = $3
        WHERE id = $4`,
      [result.lat, result.lng, result.status, cardId],
    );
    return result;
  } catch (err) {
    console.error('[geocoding] geocodeCard failed for card', cardId, err.message);
    return null;
  }
}

module.exports = { geocodeAddress, geocodeCard, buildAddressQuery };
