const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const fsp     = require('fs').promises;
const crypto  = require('crypto');
const multer  = require('multer');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');

// ── Paths ─────────────────────────────────────────────────────────
// `public/` holds files that are served as-is to clients (no auth):
//   public/collector-version.json      → version manifest
//   public/downloads/*.apk             → APK builds, served at /downloads/...
const PUBLIC_DIR    = path.resolve(__dirname, '../../public');
const DOWNLOADS_DIR = path.join(PUBLIC_DIR, 'downloads');
const MANIFEST      = path.join(PUBLIC_DIR, 'collector-version.json');

if (!fs.existsSync(PUBLIC_DIR))    fs.mkdirSync(PUBLIC_DIR,    { recursive: true });
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

const MAX_APK_BYTES = Number.parseInt(process.env.MAX_APK_BYTES, 10) || 50 * 1024 * 1024;

const apkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOWNLOADS_DIR),
  filename:    (req, file, cb) => {
    const version = (req.body && req.body.version) || crypto.randomBytes(4).toString('hex');
    const safe = String(version).replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, `collector-${safe}.apk`);
  },
});

const apkUpload = multer({
  storage: apkStorage,
  limits: { fileSize: MAX_APK_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const okMime = file.mimetype === 'application/vnd.android.package-archive'
                || file.mimetype === 'application/octet-stream';
    const okExt  = /\.apk$/i.test(file.originalname);
    if (okMime || okExt) return cb(null, true);
    cb(new Error('APK file required (.apk)'));
  },
}).single('apk');

function readManifest() {
  try {
    const raw = fs.readFileSync(MANIFEST, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { version: '0.0.0', min_supported_version: '0.0.0', apk_url: null, released_at: null, release_notes: '' };
  }
}

async function writeManifest(data) {
  await fsp.writeFile(MANIFEST, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ── GET /api/version/collector ────────────────────────────────────
// Public (no auth) — the app needs to check version even before login.
router.get('/collector', (_req, res) => {
  res.json(readManifest());
});

// ── POST /api/version/collector ───────────────────────────────────
// Admin-only. Multipart with field "apk" + body fields:
//   version (required, semver), min_supported_version, release_notes
// Saves the APK to public/downloads/collector-<version>.apk and
// updates collector-version.json atomically.
router.post(
  '/collector',
  authenticate,
  requireRole('admin'),
  (req, res, next) => {
    apkUpload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res, next) => {
    try {
      const { version, min_supported_version, release_notes } = req.body || {};
      if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
        return res.status(400).json({ error: 'version is required (semver: X.Y.Z)' });
      }
      if (min_supported_version && !/^\d+\.\d+\.\d+$/.test(min_supported_version)) {
        return res.status(400).json({ error: 'min_supported_version must be semver (X.Y.Z)' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'apk file required (field "apk")' });
      }

      const filename = path.basename(req.file.path);
      const manifest = {
        version,
        min_supported_version: min_supported_version || version,
        apk_url: `/downloads/${filename}`,
        released_at: new Date().toISOString(),
        release_notes: release_notes || '',
      };
      await writeManifest(manifest);
      res.status(201).json(manifest);
    } catch (err) { next(err); }
  }
);

// ── PUT /api/version/collector ────────────────────────────────────
// Admin-only. Body: { version?, min_supported_version?, release_notes?, apk_url? }
// Updates manifest fields without re-uploading an APK (e.g. tweak release notes
// or bump min_supported_version after the fact).
router.put('/collector', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { version, min_supported_version, release_notes, apk_url } = req.body || {};
    if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
      return res.status(400).json({ error: 'version must be semver (X.Y.Z)' });
    }
    if (min_supported_version && !/^\d+\.\d+\.\d+$/.test(min_supported_version)) {
      return res.status(400).json({ error: 'min_supported_version must be semver (X.Y.Z)' });
    }

    const current = readManifest();
    const next_   = { ...current };
    if (version !== undefined)               next_.version = version;
    if (min_supported_version !== undefined) next_.min_supported_version = min_supported_version;
    if (release_notes !== undefined)         next_.release_notes = release_notes;
    if (apk_url !== undefined)               next_.apk_url = apk_url;
    next_.released_at = new Date().toISOString();
    await writeManifest(next_);
    res.json(next_);
  } catch (err) { next(err); }
});

module.exports = router;
