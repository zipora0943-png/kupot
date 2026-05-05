// Cross-platform runner for a single SQL file.
// Usage: node scripts/runSql.js <relative-path-to-sql>
const fs   = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/runSql.js <path-to-sql>');
    process.exit(1);
  }
  const fullPath = path.resolve(process.cwd(), arg);
  if (!fs.existsSync(fullPath)) {
    console.error(`SQL file not found: ${fullPath}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(fullPath, 'utf8');
  console.log(`[runSql] executing ${fullPath} (${sql.length} bytes)`);
  try {
    await pool.query(sql);
    console.log('[runSql] done');
  } catch (err) {
    console.error('[runSql] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
