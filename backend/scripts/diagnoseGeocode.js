// Diagnostic CLI: ping Google's Geocoding API with several variations of a
// problematic address and dump exactly what comes back, so we can see WHY
// `geocodeAddress` is rejecting the result (HARD components filter on
// Google's side, localityMatches post-check, or genuine ZERO_RESULTS).
//
// Usage (from backend/):
//   node scripts/diagnoseGeocode.js
//
// No DB writes — read-only against `settings` (for the API key) and the
// Google Geocoding API. Safe to run on production.

const pool = require('../src/db/pool');

const GOOGLE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Inlined from geocoding.js so the script is self-contained — works even on
// a prod deploy that hasn't picked up the latest changes yet.
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
      if (cand.includes(target) || target.includes(cand)) return true;
    }
  }
  return false;
}

// Test cases — each one issues a separate HTTP request to Google.
// `componentsFilter` is what Google enforces HARD on its side.
// `address` is the free-text portion.
const CASES = [
  {
    name: '1. CURRENT BEHAVIOUR (post-fix): street+number, locality filter',
    address: '21, בירנבוים',
    componentsFilter: 'country:IL|locality:בני ברק',
    expectedCity: 'בני ברק',
  },
  {
    name: '2. Full street name "ד״ר נתן בירנבוים" with gershayim, locality filter',
    address: '21, ד״ר נתן בירנבוים',
    componentsFilter: 'country:IL|locality:בני ברק',
    expectedCity: 'בני ברק',
  },
  {
    name: '3. Full street name with straight quote ד"ר, locality filter',
    address: '21, ד"ר נתן בירנבוים',
    componentsFilter: 'country:IL|locality:בני ברק',
    expectedCity: 'בני ברק',
  },
  {
    name: '4. Short "בירנבוים" — RELAXED filter: administrative_area instead of locality',
    address: '21, בירנבוים',
    componentsFilter: 'country:IL|administrative_area:בני ברק',
    expectedCity: 'בני ברק',
  },
  {
    name: '5. Short "בירנבוים" — NO components filter, city appended to address',
    address: '21, בירנבוים, בני ברק',
    componentsFilter: 'country:IL',
    expectedCity: 'בני ברק',
  },
  {
    name: '6. "ויזניץ" classification probe (neighborhood as locality?)',
    address: 'ויזניץ, בני ברק',
    componentsFilter: 'country:IL',
    expectedCity: 'בני ברק',
  },
];

async function getApiKey() {
  const { rows } = await pool.query(
    `SELECT value FROM settings WHERE key = 'google_maps_api_key' LIMIT 1`,
  );
  const v = rows[0]?.value;
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function summariseComponent(c) {
  const types = Array.isArray(c.types) ? c.types.join(',') : '';
  return `    [${types}] long="${c.long_name}" short="${c.short_name}"`;
}

async function runOne(apiKey, c) {
  console.log('\n────────────────────────────────────────────────────────────');
  console.log(c.name);
  console.log(`  address:    ${c.address}`);
  console.log(`  components: ${c.componentsFilter}`);

  const params = new URLSearchParams({
    address: c.address,
    components: c.componentsFilter,
    region: 'il',
    language: 'he',
    key: apiKey,
  });
  const url = `${GOOGLE_URL}?${params.toString()}`;

  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (err) {
    console.log(`  ✗ network error: ${err.message}`);
    return;
  }

  console.log(`  → Google status: ${data.status}`);
  if (data.error_message) console.log(`  → error_message: ${data.error_message}`);

  if (!Array.isArray(data.results) || data.results.length === 0) {
    console.log('  (no results)');
    return;
  }

  data.results.forEach((r, idx) => {
    console.log(`\n  Result #${idx + 1}:`);
    console.log(`    formatted_address: ${r.formatted_address}`);
    if (r.geometry?.location) {
      console.log(`    location: lat=${r.geometry.location.lat} lng=${r.geometry.location.lng}`);
    }
    if (r.geometry?.location_type) {
      console.log(`    location_type: ${r.geometry.location_type}`);
    }
    if (Array.isArray(r.types) && r.types.length) {
      console.log(`    result types: ${r.types.join(', ')}`);
    }
    if (Array.isArray(r.address_components)) {
      console.log('    address_components:');
      r.address_components.forEach((cc) => console.log(summariseComponent(cc)));
    }
    const accepts = localityMatches(r.address_components, c.expectedCity);
    console.log(`    localityMatches("${c.expectedCity}"): ${accepts ? '✓ ACCEPT' : '✗ REJECT'}`);
  });
}

async function main() {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('No Google Maps API key found in settings table. Aborting.');
    process.exit(1);
  }
  console.log(`[diagnoseGeocode] API key found (${apiKey.length} chars). Running ${CASES.length} test cases…`);

  for (const c of CASES) {
    await runOne(apiKey, c);
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('Done. Send me the full output above and we\'ll know what to fix.');
  await pool.end();
}

main().catch((err) => {
  console.error('[diagnoseGeocode] fatal:', err);
  process.exit(1);
});
