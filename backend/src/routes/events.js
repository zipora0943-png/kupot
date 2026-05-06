const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { EVENT } = require('../logic/cardLogic');
const { isCardAssignedToCollector } = require('../logic/userAssignment');

router.use(authenticate);
// Task 36: cashroom users have no access to events — only the cashroom workflow.
router.use(requireRole('admin', 'collector'));

const ALLOWED_TYPES = Object.values(EVENT);  // installation/removal/transfer_*/collection/task_done/other

// ─── routes ───────────────────────────────────────────────────────

// GET /api/events/by-card/:cardId
router.get('/by-card/:cardId', async (req, res, next) => {
  const cardId = Number(req.params.cardId);
  if (!Number.isInteger(cardId)) return res.status(400).json({ error: 'Invalid cardId' });

  try {
    if (req.user.role === 'collector' &&
        !(await isCardAssignedToCollector(cardId, req.user.id))) {
      return res.status(403).json({ error: 'Card not assigned to this collector' });
    }
    const { rows } = await pool.query(
      `SELECT e.*, u.name AS user_name
         FROM events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.card_id = $1 ORDER BY e.created_at DESC`,
      [cardId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/events  — manual event (admin/collector for assigned cards)
router.post('/', requireRole('admin', 'collector'), async (req, res, next) => {
  const { card_id, event_type, description, image_path } = req.body || {};

  const cardId = Number(card_id);
  if (!Number.isInteger(cardId)) return res.status(400).json({ error: 'card_id required' });
  if (typeof event_type !== 'string' || !ALLOWED_TYPES.includes(event_type)) {
    return res.status(400).json({ error: `event_type must be one of: ${ALLOWED_TYPES.join(', ')}` });
  }
  // 'other' requires a description
  if (event_type === EVENT.OTHER &&
      (typeof description !== 'string' || !description.trim())) {
    return res.status(400).json({ error: 'description required for event_type=other' });
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be string or null' });
  }
  if (image_path !== undefined && image_path !== null && typeof image_path !== 'string') {
    return res.status(400).json({ error: 'image_path must be string or null' });
  }

  try {
    if (req.user.role === 'collector' &&
        !(await isCardAssignedToCollector(cardId, req.user.id))) {
      return res.status(403).json({ error: 'Card not assigned to this collector' });
    }

    const { rows } = await pool.query(
      `INSERT INTO events (card_id, event_type, description, user_id, image_path)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [cardId, event_type,
       typeof description === 'string' ? description : null,
       req.user.id,
       typeof image_path === 'string' ? image_path : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid card_id' });
    next(err);
  }
});

module.exports = router;
