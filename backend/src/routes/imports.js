// Bulk-import of boxes + first card (kartesset "A") from an .xlsx upload.
// Admin only. Two endpoints share the parser:
//   POST /api/imports/boxes/preview  → analyzes the file, returns per-row status
//                                       without touching the DB.
//   POST /api/imports/boxes/commit   → re-parses and writes all rows inside a
//                                       single transaction. Any duplicate
//                                       iron_number aborts the whole import.
const router  = require('express').Router();
const multer  = require('multer');
const XLSX    = require('xlsx');
const pool    = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { openCard, EVENT } = require('../logic/cardLogic');

router.use(authenticate);
router.use(requireRole('admin'));

// ── In-memory upload (no disk persistence; files are small spreadsheets).
const MAX_XLSX_BYTES = 10 * 1024 * 1024; // 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_XLSX_BYTES, files: 1 },
});

// Hebrew column headers expected in the spreadsheet (exact match after trim).
// Order is right-to-left as displayed; the parser keys by header name, not
// column index, so column reordering in the source file is fine.
const COL = {
  iron:    'מספר ברזל',
  street:  'רחוב',
  bldg:    'מספר',
  hood:    'שכונה',
  city:    'עיר',
  install: 'סוג התקנה',
  boxType: 'סוג קופה',
  notes:   'הערות מיקום',
};

function s(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function rowIsEmpty(r) {
  return Object.values(COL).every(h => !s(r[h]));
}

// Parse an uploaded buffer into normalized rows. Returns
// { rows: [{ rowNum, iron_number, street, building, neighborhood, city,
//            installation_type, box_type_name, location_notes }], parseError? }
function parseWorkbook(buffer) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch (err) {
    return { rows: [], parseError: `קובץ לא תקין: ${err.message}` };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], parseError: 'הקובץ ריק (אין גיליון)' };
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  const rows = [];
  raw.forEach((r, idx) => {
    if (rowIsEmpty(r)) return; // silently skip blank lines
    rows.push({
      rowNum:           idx + 2, // +1 for 0-based, +1 for header row
      iron_number:      s(r[COL.iron]),
      street:           s(r[COL.street]) || null,
      building:         s(r[COL.bldg]) || null,
      neighborhood:     s(r[COL.hood]) || null,
      city:             s(r[COL.city]) || null,
      installation_type: s(r[COL.install]) || null,
      box_type_name:    s(r[COL.boxType]) || null,
      location_notes:   s(r[COL.notes]) || null,
    });
  });
  return { rows };
}

// Classify each parsed row against current DB state.
//   status: 'ok'        — will create
//           'duplicate' — iron_number already exists → commit will ABORT all
//           'skip'      — box type unknown → row is skipped on commit
//           'error'     — missing iron_number
async function analyzeRows(rows) {
  // Pull box-type names and existing iron numbers in one shot.
  const [{ rows: typeRows }, { rows: ironRows }] = await Promise.all([
    pool.query(`SELECT id, name FROM box_types`),
    pool.query(`SELECT iron_number FROM boxes`),
  ]);
  const typeByName = new Map(typeRows.map(t => [t.name, t.id]));
  const existingIrons = new Set(ironRows.map(r => r.iron_number));

  const analyzed = rows.map(r => {
    if (!r.iron_number) {
      return { ...r, status: 'error', reason: 'מספר ברזל חסר' };
    }
    if (existingIrons.has(r.iron_number)) {
      return { ...r, status: 'duplicate', reason: 'מספר ברזל כבר קיים במערכת' };
    }
    if (r.box_type_name && !typeByName.has(r.box_type_name)) {
      return { ...r, status: 'skip', reason: `סוג קופה לא קיים: ${r.box_type_name}` };
    }
    return { ...r, status: 'ok', box_type_id: r.box_type_name ? typeByName.get(r.box_type_name) : null };
  });

  // Also catch duplicates within the file itself.
  const seenInFile = new Map();
  for (const r of analyzed) {
    if (r.status !== 'ok' && r.status !== 'duplicate') continue;
    if (seenInFile.has(r.iron_number)) {
      r.status = 'duplicate';
      r.reason = 'מספר ברזל מופיע יותר מפעם אחת בקובץ';
    } else {
      seenInFile.set(r.iron_number, r);
    }
  }

  const summary = analyzed.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, { ok: 0, skip: 0, duplicate: 0, error: 0 });

  return { analyzed, summary };
}

// ── POST /api/imports/boxes/preview
router.post('/boxes/preview', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'יש לבחור קובץ' });
  try {
    const { rows, parseError } = parseWorkbook(req.file.buffer);
    if (parseError) return res.status(400).json({ error: parseError });
    if (rows.length === 0) return res.status(400).json({ error: 'לא נמצאו שורות נתונים' });

    const { analyzed, summary } = await analyzeRows(rows);
    res.json({ rows: analyzed, summary });
  } catch (err) { next(err); }
});

// ── POST /api/imports/boxes/commit
// Re-parses the uploaded file (the preview output is advisory only — we
// re-check duplicates inside the transaction). Any duplicate iron_number
// aborts the whole import.
router.post('/boxes/commit', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'יש לבחור קובץ' });

  const { rows, parseError } = parseWorkbook(req.file.buffer);
  if (parseError) return res.status(400).json({ error: parseError });
  if (rows.length === 0) return res.status(400).json({ error: 'לא נמצאו שורות נתונים' });

  let analyzed, summary;
  try {
    ({ analyzed, summary } = await analyzeRows(rows));
  } catch (err) { return next(err); }

  if (summary.duplicate > 0) {
    return res.status(409).json({
      error: 'נמצאו מספרי ברזל קיימים — הייבוא בוטל',
      duplicates: analyzed.filter(r => r.status === 'duplicate'),
    });
  }
  if (summary.error > 0) {
    return res.status(400).json({
      error: 'נמצאו שורות עם מספר ברזל חסר — הייבוא בוטל',
      errors: analyzed.filter(r => r.status === 'error'),
    });
  }

  const toInsert = analyzed.filter(r => r.status === 'ok');
  if (toInsert.length === 0) {
    return res.status(400).json({ error: 'אין שורות לייבוא (כולן דולגו)' });
  }

  const client = await pool.connect();
  const created = [];
  const cityCache = new Set(); // avoid repeat INSERT for the same city in one run
  try {
    await client.query('BEGIN');

    // Cities: free-text in cards.city, but also insert into `cities` (without
    // district) for any city that's new so the admin can later assign a district.
    const { rows: existingCities } = await client.query(`SELECT name FROM cities`);
    for (const c of existingCities) cityCache.add(c.name);

    for (const r of toInsert) {
      if (r.city && !cityCache.has(r.city)) {
        await client.query(
          `INSERT INTO cities (name, district) VALUES ($1, NULL)
           ON CONFLICT (name) DO NOTHING`,
          [r.city]
        );
        cityCache.add(r.city);
      }

      const { rows: boxRows } = await client.query(
        `INSERT INTO boxes (iron_number, box_type_id, status)
         VALUES ($1, $2, 'active')
         RETURNING id, iron_number`,
        [r.iron_number, r.box_type_id || null]
      );
      const box = boxRows[0];

      const card = await openCard(
        box.id,
        {
          city:              r.city,
          neighborhood:      r.neighborhood,
          street:            r.street,
          building:          r.building,
          location_notes:    r.location_notes,
          installation_type: r.installation_type,
          collector_id:      null,
        },
        req.user.id,
        client,
        EVENT.INSTALLATION,
      );

      created.push({
        rowNum: r.rowNum,
        iron_number: box.iron_number,
        box_id: box.id,
        card_id: card.id,
      });
    }

    await client.query('COMMIT');
    res.json({
      success:  true,
      created:  created.length,
      skipped:  summary.skip,
      rows:     created,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'מספר ברזל כפול נתגלה בזמן הכתיבה — הייבוא בוטל' });
    }
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
