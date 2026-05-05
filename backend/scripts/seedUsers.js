// Seeds demo users with valid bcrypt hashes.
// Run after schema.sql + seed.sql.
//
// Default password for ALL demo users: "password123"
// Override via env DEMO_PASSWORD before running.
const bcrypt = require('bcryptjs');
const pool   = require('../src/db/pool');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password123';

const USERS = [
  { name: 'מנהל ראשי',   username: 'admin',      role: 'admin',
    area_assignments: [], area_exclusions: [] },
  { name: 'ישראל כהן',   username: 'collector1', role: 'collector',
    area_assignments: [{ type: 'city', value: 'בני ברק' }], area_exclusions: [] },
  { name: 'משה לוי',     username: 'collector2', role: 'collector',
    area_assignments: [{ type: 'city', value: 'ירושלים' }], area_exclusions: [] },
  { name: 'אברהם גרין',  username: 'collector3', role: 'collector',
    area_assignments: [{ type: 'city', value: 'אשדוד' }], area_exclusions: [] },
  { name: 'יעקב שטיין',  username: 'collector4', role: 'collector',
    area_assignments: [{ type: 'neighborhood', city: 'בני ברק', value: 'רמת אלחנן' }],
    area_exclusions: [] },
  { name: 'דוד מזרחי',   username: 'collector5', role: 'collector',
    area_assignments: [{ type: 'city', value: 'בני ברק' }],
    area_exclusions: [{ type: 'neighborhood', city: 'בני ברק', value: 'פועלי אגודת ישראל' }] },
  { name: 'חדר כסף',     username: 'cashroom',   role: 'cashroom',
    area_assignments: [], area_exclusions: [] },
];

async function main() {
  console.log('[seedUsers] hashing password and upserting users…');
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  try {
    for (const u of USERS) {
      await pool.query(
        `INSERT INTO users (name, username, password_hash, role, area_assignments, area_exclusions)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (username) DO UPDATE
           SET password_hash    = EXCLUDED.password_hash,
               name             = EXCLUDED.name,
               role             = EXCLUDED.role,
               area_assignments = EXCLUDED.area_assignments,
               area_exclusions  = EXCLUDED.area_exclusions`,
        [u.name, u.username, hash, u.role,
         JSON.stringify(u.area_assignments),
         JSON.stringify(u.area_exclusions)]
      );
    }
    console.log(`[seedUsers] seeded ${USERS.length} users (password: "${DEMO_PASSWORD}")`);
  } catch (err) {
    console.error('[seedUsers] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
