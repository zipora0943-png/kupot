const router = require('express').Router();
const path   = require('path');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { uploadSingle } = require('../middleware/upload');

router.use(authenticate);
// Task 36: cashroom users have no access to image uploads — only the cashroom workflow.
router.use(requireRole('admin', 'collector'));

// POST /api/uploads/image  — multipart form, field name "image"
// Returns: { path: '/uploads/<filename>' }
//
// The path is the *public URL* path (served by static at /uploads).
// Callers store this string in DB columns like events.image_path.
router.post('/image', uploadSingle('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image file required (field "image")' });
  const publicPath = `/uploads/${path.basename(req.file.path)}`;
  res.status(201).json({
    path:     publicPath,
    filename: path.basename(req.file.path),
    size:     req.file.size,
    mimetype: req.file.mimetype,
  });
});

module.exports = router;
