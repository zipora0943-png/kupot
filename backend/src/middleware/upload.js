// Image upload middleware (multer + disk storage).
// Saves to UPLOAD_DIR (default ./uploads) with a random filename.
// Returns the relative path on req.file.path that callers store in DB.
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = Number.parseInt(process.env.MAX_IMAGE_BYTES, 10) || 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, crypto.randomBytes(16).toString('hex') + safeExt);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only JPEG / PNG / WEBP images are allowed'));
    }
    cb(null, true);
  },
});

// Wrap multer middleware so its errors flow through Express's error pipeline
// with proper HTTP status codes.
function uploadSingle(field) {
  const handler = upload.single(field);
  return (req, res, next) => handler(req, res, (err) => {
    if (!err) return next();
    const status = err instanceof multer.MulterError ? 400 : 400;
    res.status(status).json({ error: err.message });
  });
}

module.exports = { uploadSingle, UPLOAD_DIR };
