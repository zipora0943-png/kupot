const pool = require('../db/pool');
const { findCollectorForLocation } = require('./userAssignment');

const EVENT = {
  INSTALLATION:   'installation',
  REMOVAL:        'removal',
  CARD_CLOSED:    'card_closed',
  TRANSFER_OPEN:  'transfer_open',
  TRANSFER_CLOSE: 'transfer_close',
  COLLECTION:     'collection',
  TASK_DONE:      'task_done',
  MARK_UNUSABLE:  'mark_unusable',
  REOPEN:         'reopen',
  AMOUNT_CHANGED: 'amount_changed',
  TASK_CANCELLED: 'task_cancelled',
  REPORT_CLOSED:  'report_closed',
  OTHER:          'other',
};

async function getActiveCard(boxId, client) {
  const db = client || pool;
  const { rows } = await db.query(
    `SELECT * FROM cards WHERE box_id = $1 AND status = 'active' ORDER BY opened_at DESC LIMIT 1`,
    [boxId]
  );
  return rows[0] || null;
}

async function openCard(boxId, location, userId, client, eventType = EVENT.INSTALLATION) {
  const db = client || pool;
  const {
    city, neighborhood, street, building, location_notes,
    collector_id, custom_name, alert_days_personal,
    receipt_required, receipt_details,
  } = location || {};

  // pre-check: refuse to open a second active card for the same box
  // (the DB also enforces this via the unique partial index)
  const existing = await getActiveCard(boxId, client);
  if (existing) {
    throw new Error('Box already has an active card; close it first');
  }

  // Auto-resolve collector from user hierarchy when caller did not specify one.
  let resolvedCollectorId = collector_id;
  if (resolvedCollectorId == null) {
    resolvedCollectorId = await findCollectorForLocation(
      { box_id: boxId, city, neighborhood, street },
      client
    );
  }

  const { rows } = await db.query(
    `INSERT INTO cards
       (box_id, city, neighborhood, street, building, location_notes,
        collector_id, custom_name, alert_days_personal,
        receipt_required, receipt_details, status, opened_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',NOW())
     RETURNING *`,
    [boxId, city, neighborhood, street, building, location_notes,
     resolvedCollectorId, custom_name, alert_days_personal,
     receipt_required || false, receipt_details]
  );
  const card = rows[0];

  await db.query(
    `INSERT INTO events (card_id, event_type, user_id) VALUES ($1,$2,$3)`,
    [card.id, eventType, userId]
  );

  return card;
}

async function closeCard(cardId, reason, userId, client, eventType = EVENT.REMOVAL) {
  const db = client || pool;
  const { rows } = await db.query(
    `UPDATE cards SET status='closed', closed_at=NOW(), closed_reason=$1
     WHERE id=$2 AND status='active' RETURNING *`,
    [reason, cardId]
  );
  if (!rows[0]) throw new Error('Card not found or already closed');
  const card = rows[0];

  await db.query(
    `INSERT INTO events (card_id, event_type, description, user_id) VALUES ($1,$2,$3,$4)`,
    [card.id, eventType, reason || null, userId]
  );

  return card;
}

async function closeActiveCardForBox(boxId, reason, userId, client, eventType = EVENT.REMOVAL) {
  const active = await getActiveCard(boxId, client);
  if (!active) return null;
  return closeCard(active.id, reason, userId, client, eventType);
}

async function reopenCard(cardId, reason, userId, client) {
  const db = client || pool;

  const { rows: cardRows } = await db.query(
    `SELECT * FROM cards WHERE id = $1`,
    [cardId]
  );
  if (!cardRows[0]) throw new Error('Card not found');
  const card = cardRows[0];
  if (card.status !== 'closed') throw new Error('Card is not closed');

  // Refuse to reopen if the box has been marked unusable.
  const { rows: boxRows } = await db.query(
    `SELECT status FROM boxes WHERE id = $1`,
    [card.box_id]
  );
  if (!boxRows[0]) throw new Error('Box not found');
  if (boxRows[0].status === 'unusable') {
    throw new Error('Cannot reopen card: box is marked unusable');
  }

  // The DB unique partial index also enforces this, but we want a clean error.
  const existing = await getActiveCard(card.box_id, client);
  if (existing) {
    throw new Error('Box already has an active card; close it first');
  }

  const { rows } = await db.query(
    `UPDATE cards SET status='active', closed_at=NULL, closed_reason=NULL
     WHERE id=$1 AND status='closed' RETURNING *`,
    [cardId]
  );
  if (!rows[0]) throw new Error('Card not found or not closed');
  const reopened = rows[0];

  // Box returns to active when reopening (covers uninstalled/inactive).
  await db.query(
    `UPDATE boxes SET status='active' WHERE id=$1 AND status IN ('uninstalled','inactive')`,
    [card.box_id]
  );

  await db.query(
    `INSERT INTO events (card_id, event_type, description, user_id) VALUES ($1,$2,$3,$4)`,
    [reopened.id, EVENT.REOPEN, reason || null, userId]
  );

  return reopened;
}

async function completeTask(taskId, executionData, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: taskRows } = await client.query(
      `SELECT t.*, tt.opens_card, tt.closes_card, tt.name AS type_name
       FROM tasks t
       JOIN task_types tt ON tt.id = t.task_type_id
       WHERE t.id = $1`,
      [taskId]
    );
    if (!taskRows[0]) throw new Error('Task not found');
    const task = taskRows[0];

    if (task.status === 'done')      throw new Error('Task already completed');
    if (task.status === 'cancelled') throw new Error('Task is cancelled');

    const {
      execution_notes, execution_image,
      new_city, new_neighborhood, new_street, new_building, new_location_notes,
      collector_id,
      override_location,
    } = executionData || {};

    // ── Validation: opens_card task requires city, unless admin overrides
    if (task.opens_card && !new_city && !override_location) {
      throw new Error('city is required for installation/transfer tasks');
    }

    // mark task done
    await client.query(
      `UPDATE tasks SET status='done', execution_notes=$1, execution_image=$2, executed_at=NOW()
       WHERE id=$3`,
      [execution_notes, execution_image, taskId]
    );

    const isTransfer     =  task.opens_card && task.closes_card;
    const isInstallation =  task.opens_card && !task.closes_card;
    const isRemoval      = !task.opens_card && task.closes_card;

    let closeEvent = null;
    let openEvent  = null;
    if (isTransfer)          { closeEvent = EVENT.TRANSFER_CLOSE; openEvent = EVENT.TRANSFER_OPEN; }
    else if (isRemoval)      { closeEvent = EVENT.REMOVAL; }
    else if (isInstallation) { openEvent  = EVENT.INSTALLATION; }

    if (closeEvent) {
      await closeActiveCardForBox(
        task.box_id,
        `ביצוע משימה: ${task.type_name}`,
        userId,
        client,
        closeEvent,
      );
    }

    if (openEvent) {
      const newCard = await openCard(
        task.box_id,
        {
          city: new_city,
          neighborhood: new_neighborhood,
          street: new_street,
          building: new_building,
          location_notes: new_location_notes,
          collector_id,
        },
        userId,
        client,
        openEvent,
      );
      await client.query(`UPDATE tasks SET card_id=$1 WHERE id=$2`, [newCard.id, taskId]);
    }

    // ── Box status updates
    if (task.opens_card) {
      // installation or transfer: box becomes active (covers uninstalled and inactive)
      await client.query(
        `UPDATE boxes SET status='active' WHERE id=$1 AND status IN ('uninstalled','inactive')`,
        [task.box_id]
      );
    } else if (isRemoval) {
      // pure removal: box becomes inactive
      await client.query(`UPDATE boxes SET status='inactive' WHERE id=$1`, [task.box_id]);
    }

    // ── Generic event for non-lifecycle tasks (only if there is an active card)
    if (!task.opens_card && !task.closes_card) {
      const activeCard = await getActiveCard(task.box_id, client);
      if (activeCard) {
        await client.query(
          `INSERT INTO events (card_id, event_type, description, user_id) VALUES ($1,$2,$3,$4)`,
          [activeCard.id, EVENT.TASK_DONE, `ביצוע משימה: ${task.type_name}`, userId]
        );
      }
    }

    await client.query('COMMIT');

    const { rows: updated } = await client.query(
      `SELECT t.*, tt.name AS type_name, tt.icon
       FROM tasks t
       JOIN task_types tt ON tt.id = t.task_type_id
       WHERE t.id = $1`,
      [taskId]
    );
    return { success: true, task: updated[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Admin override: mark task done WITHOUT triggering card lifecycle.
// Used when admin wants to fix history (e.g. mark a forgotten task as done
// without opening/closing cards or creating events).
async function markTaskDoneNoLifecycle(taskId, executionData, userId) {
  const { execution_notes, execution_image } = executionData || {};
  const { rows } = await pool.query(
    `UPDATE tasks
       SET status='done',
           execution_notes=$1,
           execution_image=$2,
           executed_at=NOW()
     WHERE id=$3 AND status <> 'done'
     RETURNING *`,
    [execution_notes, execution_image, taskId]
  );
  if (!rows[0]) throw new Error('Task not found or already done');
  return { success: true, task: rows[0], note: 'no-lifecycle (admin override)' };
}

module.exports = {
  getActiveCard,
  openCard,
  closeCard,
  closeActiveCardForBox,
  reopenCard,
  completeTask,
  markTaskDoneNoLifecycle,
  EVENT,
};
