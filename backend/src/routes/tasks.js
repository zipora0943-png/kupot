const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { completeTask, markTaskDoneNoLifecycle, reportTaskNotExecuted, EVENT } = require('../logic/cardLogic');

router.use(authenticate);
// Task 36: cashroom users have no access to tasks — only the cashroom workflow.
router.use(requireRole('admin', 'collector'));

const VALID_STATUSES = ['open', 'in_progress', 'done', 'cancelled', 'not_executed'];

// ─── helpers ──────────────────────────────────────────────────────
async function fetchTaskWithType(taskId) {
  const { rows } = await pool.query(
    `SELECT t.*, tt.opens_card, tt.closes_card, tt.name AS type_name, tt.icon,
            b.iron_number, u.name AS assigned_name, cb.name AS created_by_name
       FROM tasks t
       JOIN task_types tt ON tt.id = t.task_type_id
       JOIN boxes b ON b.id = t.box_id
       LEFT JOIN users u  ON u.id  = t.assigned_to
       LEFT JOIN users cb ON cb.id = t.created_by
      WHERE t.id = $1`,
    [taskId]
  );
  return rows[0] || null;
}

// ─── routes ───────────────────────────────────────────────────────

// GET /api/tasks
router.get('/', async (req, res, next) => {
  const { status, assigned_to, box_id, task_type_id } = req.query;

  let q = `SELECT t.*, tt.name AS type_name, tt.icon, tt.opens_card, tt.closes_card,
                  b.iron_number, u.name AS assigned_name, cb.name AS created_by_name
             FROM tasks t
             JOIN task_types tt ON tt.id = t.task_type_id
             JOIN boxes b ON b.id = t.box_id
             LEFT JOIN users u  ON u.id  = t.assigned_to
             LEFT JOIN users cb ON cb.id = t.created_by
            WHERE 1=1`;
  const p = [];

  // ── Collector: only their own tasks
  if (req.user.role === 'collector') {
    p.push(req.user.id); q += ` AND t.assigned_to = $${p.length}`;
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    p.push(status); q += ` AND t.status = $${p.length}`;
  }
  if (assigned_to !== undefined) {
    const aid = Number(assigned_to);
    if (!Number.isInteger(aid)) return res.status(400).json({ error: 'Invalid assigned_to' });
    // collector can't query other collectors' tasks
    if (req.user.role === 'collector' && aid !== req.user.id) {
      return res.status(403).json({ error: 'Cannot view tasks of another collector' });
    }
    p.push(aid); q += ` AND t.assigned_to = $${p.length}`;
  }
  if (box_id !== undefined) {
    const bid = Number(box_id);
    if (!Number.isInteger(bid)) return res.status(400).json({ error: 'Invalid box_id' });
    p.push(bid); q += ` AND t.box_id = $${p.length}`;
  }
  if (task_type_id !== undefined) {
    const tid = Number(task_type_id);
    if (!Number.isInteger(tid)) return res.status(400).json({ error: 'Invalid task_type_id' });
    p.push(tid); q += ` AND t.task_type_id = $${p.length}`;
  }
  q += ` ORDER BY t.created_at DESC`;

  try {
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const task = await fetchTaskWithType(id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'collector' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Task not assigned to this collector' });
    }
    res.json(task);
  } catch (err) { next(err); }
});

// POST /api/tasks  — admin only
// For non-installation tasks (task_type.opens_card === false), the active card
// of the target box is auto-resolved and persisted as task.card_id.
// If no active card exists for such tasks, creation is blocked (409).
router.post('/', requireRole('admin'), async (req, res, next) => {
  const {
    box_id, task_type_id, assigned_to, notes, image_path,
    new_city, new_neighborhood, new_street, new_building, new_location_notes,
  } = req.body || {};

  const bid = Number(box_id);
  const ttid = Number(task_type_id);
  if (!Number.isInteger(bid))  return res.status(400).json({ error: 'box_id required' });
  if (!Number.isInteger(ttid)) return res.status(400).json({ error: 'task_type_id required' });

  let aid = null;
  if (assigned_to !== undefined && assigned_to !== null) {
    aid = Number(assigned_to);
    if (!Number.isInteger(aid)) return res.status(400).json({ error: 'Invalid assigned_to' });
  }

  if (image_path !== undefined && image_path !== null && typeof image_path !== 'string') {
    return res.status(400).json({ error: 'image_path must be string or null' });
  }

  try {
    const { rows: typeRows } = await pool.query(
      `SELECT opens_card FROM task_types WHERE id = $1`,
      [ttid]
    );
    if (!typeRows[0]) return res.status(400).json({ error: 'Invalid task_type_id' });
    const opensCard = !!typeRows[0].opens_card;

    let cardId = null;
    if (!opensCard) {
      const { rows: cardRows } = await pool.query(
        `SELECT id FROM cards WHERE box_id = $1 AND status = 'active' ORDER BY opened_at DESC LIMIT 1`,
        [bid]
      );
      if (!cardRows[0]) {
        return res.status(409).json({ error: 'אין כרטסת פעילה לקופה זו — לא ניתן ליצור משימה מסוג זה' });
      }
      cardId = cardRows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (box_id, card_id, task_type_id, assigned_to, created_by, notes, image_path,
                           new_city, new_neighborhood, new_street, new_building, new_location_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [bid, cardId, ttid, aid, req.user.id,
       typeof notes === 'string' ? notes : null,
       image_path || null,
       new_city ?? null, new_neighborhood ?? null, new_street ?? null,
       new_building ?? null, new_location_notes ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid box_id, task_type_id, or assigned_to' });
    next(err);
  }
});

// PUT /api/tasks/:id  — partial update, admin only
// NOTE: Setting status='done' is BLOCKED here for tasks that open or close a card.
//       Admin must use /:id/complete (full lifecycle) or
//                    /:id/mark-done-no-lifecycle (admin override) instead.
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { assigned_to, notes, status, image_path,
          new_city, new_neighborhood, new_street, new_building, new_location_notes } = req.body || {};

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'done') {
      const task = await fetchTaskWithType(id);
      if (!task) return res.status(404).json({ error: 'Not found' });
      if (task.opens_card || task.closes_card) {
        return res.status(400).json({
          error: 'Cannot set status=done directly for lifecycle tasks',
          hint: 'Use POST /api/tasks/:id/complete (full flow) or /api/tasks/:id/mark-done-no-lifecycle (admin override)',
        });
      }
    }
  }

  const sets = [];
  const params = [];
  if (assigned_to !== undefined) {
    if (assigned_to !== null && !Number.isInteger(Number(assigned_to))) {
      return res.status(400).json({ error: 'Invalid assigned_to' });
    }
    params.push(assigned_to === null ? null : Number(assigned_to));
    sets.push(`assigned_to = $${params.length}`);
  }
  if (notes !== undefined) {
    if (notes !== null && typeof notes !== 'string')
      return res.status(400).json({ error: 'notes must be string or null' });
    params.push(notes); sets.push(`notes = $${params.length}`);
  }
  if (image_path !== undefined) {
    if (image_path !== null && typeof image_path !== 'string')
      return res.status(400).json({ error: 'image_path must be string or null' });
    params.push(image_path); sets.push(`image_path = $${params.length}`);
  }
  if (status !== undefined)        { params.push(status);          sets.push(`status = $${params.length}`); }
  if (new_city !== undefined)      { params.push(new_city);        sets.push(`new_city = $${params.length}`); }
  if (new_neighborhood !== undefined) { params.push(new_neighborhood); sets.push(`new_neighborhood = $${params.length}`); }
  if (new_street !== undefined)    { params.push(new_street);      sets.push(`new_street = $${params.length}`); }
  if (new_building !== undefined)  { params.push(new_building);    sets.push(`new_building = $${params.length}`); }
  if (new_location_notes !== undefined) { params.push(new_location_notes); sets.push(`new_location_notes = $${params.length}`); }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid foreign key' });
    next(err);
  }
});

// POST /api/tasks/:id/complete  — full lifecycle: open/close cards, create events
// Allowed for: admin, OR the collector assigned to the task.
router.post('/:id/complete', requireRole('admin', 'collector'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const task = await fetchTaskWithType(id);
    if (!task) return res.status(404).json({ error: 'Not found' });

    if (req.user.role === 'collector' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Task not assigned to this collector' });
    }

    // Only admin can use override_location to skip the city requirement
    const body = { ...(req.body || {}) };
    if (body.override_location && req.user.role !== 'admin') {
      delete body.override_location;
    }

    const result = await completeTask(id, body, req.user.id);
    res.json(result);
  } catch (err) {
    if (/^Task not found$/.test(err.message))         return res.status(404).json({ error: err.message });
    if (/already (completed|cancelled)/.test(err.message)) return res.status(409).json({ error: err.message });
    if (/city is required/.test(err.message))         return res.status(400).json({ error: err.message });
    if (/already has an active card/.test(err.message)) return res.status(409).json({ error: err.message });
    next(err);
  }
});

// POST /api/tasks/:id/mark-done-no-lifecycle  — admin override
// Marks the task as done WITHOUT opening/closing cards or creating events.
// Use only when admin needs to fix history (e.g. a forgotten task).
router.post('/:id/mark-done-no-lifecycle', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const result = await markTaskDoneNoLifecycle(id, req.body || {}, req.user.id);
    res.json(result);
  } catch (err) {
    if (/not found or already done/.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// POST /api/tasks/:id/cancel  — admin only
// Cancels a task that is not already in a final state (done/cancelled).
// If the task is linked to a card, a `task_cancelled` event is logged on it.
router.post('/:id/cancel', requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { reason } = req.body || {};
  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    return res.status(400).json({ error: 'reason must be string or null' });
  }
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: taskRows } = await client.query(
      `SELECT t.*, tt.name AS type_name
         FROM tasks t
         JOIN task_types tt ON tt.id = t.task_type_id
        WHERE t.id = $1
        FOR UPDATE`,
      [id]
    );
    if (!taskRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const task = taskRows[0];

    if (task.status === 'done') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'לא ניתן לבטל משימה שכבר בוצעה' });
    }
    if (task.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'המשימה כבר בוטלה' });
    }

    const { rows: updated } = await client.query(
      `UPDATE tasks
          SET status = 'cancelled',
              executed_at = NOW(),
              cancellation_reason = $2
        WHERE id = $1
        RETURNING *`,
      [id, trimmedReason || null]
    );

    if (task.card_id) {
      const description = trimmedReason
        ? `ביטול משימה (${task.type_name}): ${trimmedReason}`
        : `ביטול משימה: ${task.type_name}`;
      await client.query(
        `INSERT INTO events (card_id, event_type, description, user_id) VALUES ($1,$2,$3,$4)`,
        [task.card_id, EVENT.TASK_CANCELLED, description, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, task: updated[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/tasks/:id/not-executed — close a task as "not executed" with a reason
// Allowed for: admin, OR the collector assigned to the task.
// Sets status='not_executed' + reason; logs an event on the task's card
// (or the box's active card) without touching card lifecycle.
router.post('/:id/not-executed', requireRole('admin', 'collector'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { reason } = req.body || {};
  if (typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'יש להזין סיבה לאי-ביצוע' });
  }

  try {
    const task = await fetchTaskWithType(id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'collector' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Task not assigned to this collector' });
    }

    const result = await reportTaskNotExecuted(id, reason, req.user.id);
    res.json(result);
  } catch (err) {
    if (/^Task not found$/.test(err.message))         return res.status(404).json({ error: err.message });
    if (/already (completed|reported)/.test(err.message)) return res.status(409).json({ error: err.message });
    if (/cancelled/.test(err.message))                return res.status(409).json({ error: err.message });
    if (/reason is required/.test(err.message))       return res.status(400).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
