// Shared helpers for integration tests (require a real DB).
// Tests are skipped unless RUN_DB_TESTS=true is set in the environment.
const pool = require('../../src/db/pool');

const SHOULD_RUN = process.env.RUN_DB_TESTS === 'true';

// describe-or-skip: use this to gate a whole suite
const describeDb = SHOULD_RUN ? describe : describe.skip;

// Wipe all transactional tables (keeps lookup tables intact).
async function resetDb() {
  await pool.query(`
    TRUNCATE TABLE events, envelopes, reports, tasks, cards, boxes, users
    RESTART IDENTITY CASCADE
  `);
}

// Insert a user and return its id.
async function insertUser({ name, username, role, area_assignments = [], area_exclusions = [] }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, username, password_hash, role, area_assignments, area_exclusions)
     VALUES ($1, $2, 'x', $3, $4, $5) RETURNING id`,
    [name, username, role, JSON.stringify(area_assignments), JSON.stringify(area_exclusions)]
  );
  return rows[0].id;
}

// Insert a box and return its id.
async function insertBox({ iron_number, status = 'uninstalled' }) {
  const { rows } = await pool.query(
    `INSERT INTO boxes (iron_number, status) VALUES ($1, $2) RETURNING id`,
    [iron_number, status]
  );
  return rows[0].id;
}

// Get the row of a box by id.
async function getBox(id) {
  const { rows } = await pool.query(`SELECT * FROM boxes WHERE id = $1`, [id]);
  return rows[0] || null;
}

// Insert a task and return its id.
async function insertTask({ box_id, task_type_id, assigned_to, status = 'open',
                            new_city = null, new_neighborhood = null, new_street = null }) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (box_id, task_type_id, assigned_to, status,
                         new_city, new_neighborhood, new_street)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [box_id, task_type_id, assigned_to, status, new_city, new_neighborhood, new_street]
  );
  return rows[0].id;
}

// Look up task_type id by Hebrew name (matches seed).
async function getTaskTypeId(name) {
  const { rows } = await pool.query(`SELECT id FROM task_types WHERE name = $1`, [name]);
  if (!rows[0]) throw new Error(`Task type "${name}" not seeded`);
  return rows[0].id;
}

// Count rows.
async function count(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return Number(rows[0].count);
}

module.exports = {
  pool, describeDb, resetDb,
  insertUser, insertBox, getBox, insertTask, getTaskTypeId, count,
};
