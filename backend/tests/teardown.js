// Jest globalTeardown — closes the shared pg pool so node exits cleanly.
module.exports = async function teardown() {
  try {
    const pool = require('../src/db/pool');
    await pool.end();
  } catch {
    // pool may have not been required by the test run — fine.
  }
};
