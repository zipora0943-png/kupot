// Integration tests for cardLogic — require a real PostgreSQL DB.
// Run: RUN_DB_TESTS=true npm test
const {
  pool, describeDb, resetDb,
  insertUser, insertBox, getBox, insertTask, getTaskTypeId, count,
} = require('./_helpers');

const {
  getActiveCard, openCard, closeCard, completeTask, markTaskDoneNoLifecycle, EVENT,
} = require('../../src/logic/cardLogic');

describeDb('cardLogic', () => {
  let adminId, collectorId;

  beforeEach(async () => {
    await resetDb();
    adminId     = await insertUser({ name: 'Admin', username: 'admin', role: 'admin' });
    collectorId = await insertUser({ name: 'Coll',  username: 'coll',  role: 'collector' });
  });

  // ── getActiveCard ──────────────────────────────────────────────
  describe('getActiveCard', () => {
    test('returns null when box has no card', async () => {
      const box = await insertBox({ iron_number: 'B1' });
      expect(await getActiveCard(box)).toBeNull();
    });

    test('returns the active card', async () => {
      const box = await insertBox({ iron_number: 'B1', status: 'active' });
      const card = await openCard(box, { city: 'X' }, adminId);
      const found = await getActiveCard(box);
      expect(found.id).toBe(card.id);
    });
  });

  // ── openCard ───────────────────────────────────────────────────
  describe('openCard', () => {
    test('creates card and an event', async () => {
      const box = await insertBox({ iron_number: 'B1' });
      const card = await openCard(box, { city: 'A' }, adminId);
      expect(card.box_id).toBe(box);
      expect(card.status).toBe('active');
      const events = await count(
        `SELECT COUNT(*) FROM events WHERE card_id = $1 AND event_type = $2`,
        [card.id, EVENT.INSTALLATION]
      );
      expect(events).toBe(1);
    });

    test('rejects opening a second active card on same box', async () => {
      const box = await insertBox({ iron_number: 'B1' });
      await openCard(box, { city: 'A' }, adminId);
      await expect(openCard(box, { city: 'B' }, adminId))
        .rejects.toThrow(/active card/i);
    });
  });

  // ── closeCard ──────────────────────────────────────────────────
  describe('closeCard', () => {
    test('closes an active card and emits removal event', async () => {
      const box  = await insertBox({ iron_number: 'B1' });
      const card = await openCard(box, { city: 'A' }, adminId);
      const closed = await closeCard(card.id, 'reason', adminId);
      expect(closed.status).toBe('closed');
      expect(closed.closed_at).not.toBeNull();
      const removals = await count(
        `SELECT COUNT(*) FROM events WHERE card_id = $1 AND event_type = $2`,
        [card.id, EVENT.REMOVAL]
      );
      expect(removals).toBe(1);
    });

    test('rejects closing an already-closed card', async () => {
      const box  = await insertBox({ iron_number: 'B1' });
      const card = await openCard(box, { city: 'A' }, adminId);
      await closeCard(card.id, null, adminId);
      await expect(closeCard(card.id, null, adminId)).rejects.toThrow(/already closed/i);
    });
  });

  // ── completeTask ──────────────────────────────────────────────
  describe('completeTask: installation', () => {
    test('opens a new card, activates box, emits installation event', async () => {
      const box = await insertBox({ iron_number: 'B1', status: 'uninstalled' });
      const tt  = await getTaskTypeId('התקנה');
      const task = await insertTask({
        box_id: box, task_type_id: tt, assigned_to: collectorId,
        new_city: 'Tel Aviv',
      });

      const result = await completeTask(task, { new_city: 'Tel Aviv' }, collectorId);
      expect(result.success).toBe(true);

      const updatedBox = await getBox(box);
      expect(updatedBox.status).toBe('active');

      const card = await getActiveCard(box);
      expect(card).not.toBeNull();
      expect(card.city).toBe('Tel Aviv');

      const ev = await count(
        `SELECT COUNT(*) FROM events WHERE card_id = $1 AND event_type = $2`,
        [card.id, EVENT.INSTALLATION]
      );
      expect(ev).toBe(1);
    });

    test('refuses missing city without admin override', async () => {
      const box = await insertBox({ iron_number: 'B1' });
      const tt  = await getTaskTypeId('התקנה');
      const task = await insertTask({ box_id: box, task_type_id: tt, assigned_to: collectorId });
      await expect(completeTask(task, {}, collectorId))
        .rejects.toThrow(/city is required/i);

      // task should still be 'open'
      const { rows } = await pool.query(`SELECT status FROM tasks WHERE id = $1`, [task]);
      expect(rows[0].status).toBe('open');
    });

    test('admin override allows missing city', async () => {
      const box = await insertBox({ iron_number: 'B1' });
      const tt  = await getTaskTypeId('התקנה');
      const task = await insertTask({ box_id: box, task_type_id: tt, assigned_to: adminId });
      const result = await completeTask(task, { override_location: true }, adminId);
      expect(result.success).toBe(true);
    });

    test('reactivates a previously inactive box', async () => {
      const box = await insertBox({ iron_number: 'B1', status: 'inactive' });
      const tt  = await getTaskTypeId('התקנה');
      const task = await insertTask({
        box_id: box, task_type_id: tt, assigned_to: adminId, new_city: 'X',
      });
      await completeTask(task, { new_city: 'X' }, adminId);
      expect((await getBox(box)).status).toBe('active');
    });
  });

  describe('completeTask: removal', () => {
    test('closes the active card and deactivates box', async () => {
      const box = await insertBox({ iron_number: 'B1', status: 'active' });
      await openCard(box, { city: 'X' }, adminId);

      const tt = await getTaskTypeId('הסרה');
      const task = await insertTask({ box_id: box, task_type_id: tt, assigned_to: collectorId });
      await completeTask(task, {}, collectorId);

      expect((await getBox(box)).status).toBe('inactive');
      expect(await getActiveCard(box)).toBeNull();
    });
  });

  describe('completeTask: transfer', () => {
    test('closes old card, opens new card, emits two events, box stays active', async () => {
      const box = await insertBox({ iron_number: 'B1', status: 'active' });
      const oldCard = await openCard(box, { city: 'OldCity' }, adminId);

      const tt = await getTaskTypeId('העברת מיקום');
      const task = await insertTask({
        box_id: box, task_type_id: tt, assigned_to: collectorId, new_city: 'NewCity',
      });
      await completeTask(task, { new_city: 'NewCity' }, collectorId);

      const fresh = await getActiveCard(box);
      expect(fresh.id).not.toBe(oldCard.id);
      expect(fresh.city).toBe('NewCity');

      const closedEvents = await count(
        `SELECT COUNT(*) FROM events WHERE card_id = $1 AND event_type = $2`,
        [oldCard.id, EVENT.TRANSFER_CLOSE]
      );
      const openedEvents = await count(
        `SELECT COUNT(*) FROM events WHERE card_id = $1 AND event_type = $2`,
        [fresh.id, EVENT.TRANSFER_OPEN]
      );
      expect(closedEvents).toBe(1);
      expect(openedEvents).toBe(1);
      expect((await getBox(box)).status).toBe('active');
    });
  });

  describe('completeTask: non-lifecycle task', () => {
    test('emits a task_done event and does not touch cards', async () => {
      const box = await insertBox({ iron_number: 'B1', status: 'active' });
      const card = await openCard(box, { city: 'X' }, adminId);

      const tt = await getTaskTypeId('תיקון');
      const task = await insertTask({ box_id: box, task_type_id: tt, assigned_to: collectorId });
      await completeTask(task, { execution_notes: 'fixed' }, collectorId);

      // card still active
      const stillActive = await getActiveCard(box);
      expect(stillActive.id).toBe(card.id);

      const taskDone = await count(
        `SELECT COUNT(*) FROM events WHERE card_id = $1 AND event_type = $2`,
        [card.id, EVENT.TASK_DONE]
      );
      expect(taskDone).toBe(1);
    });
  });

  describe('completeTask: idempotency / state guards', () => {
    test('refuses to complete a task that is already done', async () => {
      const box = await insertBox({ iron_number: 'B1' });
      const tt  = await getTaskTypeId('תיקון');
      const task = await insertTask({
        box_id: box, task_type_id: tt, assigned_to: adminId, status: 'done',
      });
      await expect(completeTask(task, {}, adminId)).rejects.toThrow(/already completed/i);
    });

    test('refuses to complete a cancelled task', async () => {
      const box = await insertBox({ iron_number: 'B1' });
      const tt  = await getTaskTypeId('תיקון');
      const task = await insertTask({
        box_id: box, task_type_id: tt, assigned_to: adminId, status: 'cancelled',
      });
      await expect(completeTask(task, {}, adminId)).rejects.toThrow(/cancelled/i);
    });
  });

  describe('markTaskDoneNoLifecycle', () => {
    test('marks task done without opening/closing cards or creating events', async () => {
      const box = await insertBox({ iron_number: 'B1', status: 'uninstalled' });
      const tt  = await getTaskTypeId('התקנה'); // would normally open a card

      const task = await insertTask({
        box_id: box, task_type_id: tt, assigned_to: adminId,
      });
      const result = await markTaskDoneNoLifecycle(task, { execution_notes: 'manual' }, adminId);
      expect(result.success).toBe(true);

      // box stays uninstalled (no lifecycle ran)
      expect((await getBox(box)).status).toBe('uninstalled');
      // no card opened
      expect(await getActiveCard(box)).toBeNull();
      // no events
      const evs = await count(`SELECT COUNT(*) FROM events`);
      expect(evs).toBe(0);
    });
  });
});
