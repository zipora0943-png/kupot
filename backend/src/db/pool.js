// Load .env early so this module works even when imported by standalone
// scripts (seed runners, tests) that don't go through index.js.
require('dotenv').config();

const { Pool } = require('pg');

const useSsl = (process.env.DB_SSL || '').toLowerCase() === 'true';

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number.parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME     || 'kupot_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: Number.parseInt(process.env.DB_POOL_MAX, 10) || 10,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Idle-client errors land here; log but don't crash.
  console.error('[pool] unexpected idle client error:', err);
});

module.exports = pool;
