// Diagnostic v2 — more aggressive variations for "בירנבוים בני ברק", because
// v1 showed Google ALWAYS returns Petah Tikva for that street name. We know
// the street exists in Bnei Brak (user confirmed on Google Maps), so we need
// to find HOW to query the API to surface that result.
//
// Tries:
//   - `bounds=` (geographic viewport bias on Bnei Brak)
//   - `region=il`, `language=he/iw`
//   - Different renderings of the street name (with prefixes רחוב/דרך, etc.)
//   - Different word orders
//   - Google Places "findplacefromtext" API (sometimes finds what Geocoding misses)

const pool = require('../src/db/pool');
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_FIND = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const PLACES_TEXT = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

// Bnei Brak rough bounding box: SW=(32.075, 34.825) NE=(32.100, 34.850)
const BNEI_BRAK_BOUNDS = '32.075,34.825|32.100,34.850';

const GEOCODE_CASES = [
  {
    name: 'G0a. English street name: "Doctor Natan Birnboim Street, Bnei Brak"',
    params: {
      address: 'Doctor Natan Birnboim Street, Bnei Brak',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'en',
    },
  },
  {
    name: 'G0b. English with number: "21 Doctor Natan Birnboim Street, Bnei Brak"',
    params: {
      address: '21 Doctor Natan Birnboim Street, Bnei Brak',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'en',
    },
  },
  {
    name: 'G0c. Hebrew ROUTE only (no number), result_type=route — find the street itself',
    params: {
      address: 'ד״ר נתן בירנבוים, בני ברק',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'he',
      result_type: 'route',
    },
  },
  {
    name: 'G0d. Hebrew route + locality components + result_type=route',
    params: {
      address: 'ד״ר נתן בירנבוים',
      components: 'country:IL|locality:בני ברק',
      region: 'il',
      language: 'he',
      result_type: 'route',
    },
  },
  {
    name: 'G1. Number+street with bounds= viewport bias on Bnei Brak (no components)',
    params: {
      address: '21, ד״ר נתן בירנבוים',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'he',
    },
  },
  {
    name: 'G2. With "רחוב" prefix + bounds',
    params: {
      address: 'רחוב ד״ר נתן בירנבוים 21, בני ברק',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'he',
    },
  },
  {
    name: 'G3. With "דרך" prefix (sometimes the street is "Derech")',
    params: {
      address: 'דרך ד״ר נתן בירנבוים 21, בני ברק',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'he',
    },
  },
  {
    name: 'G4. Neighborhood-first: "ויזניץ, בירנבוים 21, בני ברק"',
    params: {
      address: 'ויזניץ, בירנבוים 21, בני ברק',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'he',
    },
  },
  {
    name: 'G5. English Bnei Brak with Hebrew street',
    params: {
      address: '21 ד״ר נתן בירנבוים, Bnei Brak',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'he',
    },
  },
  {
    name: 'G6. language=iw (legacy code for Hebrew)',
    params: {
      address: '21, ד״ר נתן בירנבוים, בני ברק',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'iw',
    },
  },
  {
    name: 'G7. Just neighborhood — what is the centroid Google returns?',
    params: {
      address: 'ויזניץ, בני ברק',
      bounds: BNEI_BRAK_BOUNDS,
      region: 'il',
      language: 'he',
    },
  },
];

const PLACES_CASES = [
  {
    api: 'findplace',
    name: 'P1. Places findplacefromtext: "ד״ר נתן בירנבוים 21 בני ברק"',
    params: {
      input: 'ד״ר נתן בירנבוים 21 בני ברק',
      inputtype: 'textquery',
      fields: 'formatted_address,geometry,name,types',
      language: 'he',
    },
  },
  {
    api: 'textsearch',
    name: 'P2. Places textsearch: "בירנבוים בני ברק"',
    params: {
      query: 'בירנבוים בני ברק',
      region: 'il',
      language: 'he',
      location: '32.0825,34.8375',
      radius: '2000',
    },
  },
  {
    api: 'textsearch',
    name: 'P3. Places textsearch: "ד״ר נתן בירנבוים 21 בני ברק"',
    params: {
      query: 'ד״ר נתן בירנבוים 21 בני ברק',
      region: 'il',
      language: 'he',
      location: '32.0825,34.8375',
      radius: '2000',
    },
  },
];

async function getApiKey() {
  const { rows } = await pool.query(
    `SELECT value FROM settings WHERE key = 'google_maps_api_key' LIMIT 1`,
  );
  const v = rows[0]?.value;
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function bnei_brak_box_check(lat, lng) {
  return lat >= 32.075 && lat <= 32.100 && lng >= 34.825 && lng <= 34.850;
}

async function runGeocode(apiKey, c) {
  console.log('\n────────────────────────────────────────────────────────────');
  console.log(c.name);
  const params = new URLSearchParams({ ...c.params, key: apiKey });
  console.log(`  query: ${params.toString().replace(apiKey, '***')}`);
  let data;
  try {
    const res = await fetch(`${GEOCODE_URL}?${params}`);
    data = await res.json();
  } catch (err) {
    console.log(`  ✗ network: ${err.message}`);
    return;
  }
  console.log(`  → status: ${data.status}${data.error_message ? ' / ' + data.error_message : ''}`);
  if (!Array.isArray(data.results) || data.results.length === 0) { console.log('  (no results)'); return; }
  data.results.slice(0, 3).forEach((r, i) => {
    const loc = r.geometry?.location || {};
    const inBnei = bnei_brak_box_check(loc.lat, loc.lng);
    console.log(`  #${i+1}: ${r.formatted_address}`);
    console.log(`       lat=${loc.lat} lng=${loc.lng}  → in BB box? ${inBnei ? '✓ YES' : '✗ no'}`);
    console.log(`       types=${(r.types || []).join(',')}  location_type=${r.geometry?.location_type}`);
  });
}

async function runPlaces(apiKey, c) {
  console.log('\n────────────────────────────────────────────────────────────');
  console.log(c.name);
  const url = c.api === 'findplace' ? PLACES_FIND : PLACES_TEXT;
  const params = new URLSearchParams({ ...c.params, key: apiKey });
  console.log(`  query: ${params.toString().replace(apiKey, '***')}`);
  let data;
  try {
    const res = await fetch(`${url}?${params}`);
    data = await res.json();
  } catch (err) {
    console.log(`  ✗ network: ${err.message}`);
    return;
  }
  console.log(`  → status: ${data.status}${data.error_message ? ' / ' + data.error_message : ''}`);
  const list = data.candidates || data.results || [];
  if (!list.length) { console.log('  (no results)'); return; }
  list.slice(0, 5).forEach((r, i) => {
    const loc = r.geometry?.location || {};
    const inBnei = bnei_brak_box_check(loc.lat, loc.lng);
    console.log(`  #${i+1}: ${r.name || ''} — ${r.formatted_address}`);
    console.log(`       lat=${loc.lat} lng=${loc.lng}  → in BB box? ${inBnei ? '✓ YES' : '✗ no'}`);
    console.log(`       types=${(r.types || []).join(',')}`);
  });
}

async function main() {
  const apiKey = await getApiKey();
  if (!apiKey) { console.error('No API key.'); process.exit(1); }
  console.log(`[diagnoseGeocode2] running ${GEOCODE_CASES.length} geocode cases + ${PLACES_CASES.length} places cases`);

  console.log('\n══════════ GEOCODING API ══════════');
  for (const c of GEOCODE_CASES) await runGeocode(apiKey, c);

  console.log('\n══════════ PLACES API ══════════');
  for (const c of PLACES_CASES) await runPlaces(apiKey, c);

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('Done. Any line with "in BB box? ✓ YES" is a candidate technique.');
  await pool.end();
}

main().catch((err) => { console.error('[diagnoseGeocode2] fatal:', err); process.exit(1); });
