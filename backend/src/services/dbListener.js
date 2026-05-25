// ===== PostgreSQL LISTEN client =====
// Dedicated long-lived pg.Client that listens to the `kupot_events` channel
// (populated by per-table triggers — see schema.sql). For every NOTIFY message
// it re-broadcasts a Socket.IO event to the rooms that should hear about it.
//
// LISTEN ties up a connection for its lifetime, so we keep a separate Client
// (NOT borrowed from the shared pool). On disconnect we retry with backoff.

const { Client } = require('pg');
const socket = require('./socket');

// Which roles should be notified about a change to each tracked table. The
// payload only contains {table, op, id} — no sensitive row data — but we still
// scope by role so each client only refetches what it can actually see.
const TABLE_AUDIENCES = {
  boxes:              ['admin', 'collector', 'cashroom'],
  cards:              ['admin', 'collector', 'cashroom'],
  envelopes:          ['admin', 'collector', 'cashroom'],
  tasks:              ['admin', 'collector', 'cashroom'],
  reports:            ['admin', 'collector', 'cashroom'],
  events:             ['admin', 'collector', 'cashroom'],
  users:              ['admin', 'collector', 'cashroom'],
  settings:           ['admin', 'collector', 'cashroom'],
  task_types:         ['admin', 'collector', 'cashroom'],
  report_types:       ['admin', 'collector', 'cashroom'],
  box_types:          ['admin', 'collector', 'cashroom'],
  cities:             ['admin', 'collector', 'cashroom'],
  location_overrides: ['admin'],
};

const CHANNEL = 'kupot_events';
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

let client = null;
let stopping = false;
let reconnectDelay = RECONNECT_MIN_MS;

function buildClient() {
  const useSsl = (process.env.DB_SSL || '').toLowerCase() === 'true';
  return new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number.parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME     || 'kupot_db',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

function handleNotification(msg) {
  if (msg.channel !== CHANNEL) return;
  let parsed;
  try {
    parsed = JSON.parse(msg.payload);
  } catch {
    console.warn('[dbListener] dropping malformed payload:', msg.payload);
    return;
  }
  const { t: table, o: op, id } = parsed;
  if (!table || !op) return;

  const audience = TABLE_AUDIENCES[table];
  if (!audience) return; // unknown table — ignore

  const rooms = audience.map((role) => `role:${role}`);
  socket.broadcastMany(rooms, 'entity.changed', { table, op, id });
}

async function connectAndListen() {
  client = buildClient();

  client.on('notification', handleNotification);
  client.on('error', (err) => {
    console.error('[dbListener] client error:', err.message);
    scheduleReconnect();
  });
  client.on('end', () => {
    if (!stopping) scheduleReconnect();
  });

  await client.connect();
  await client.query(`LISTEN ${CHANNEL}`);
  reconnectDelay = RECONNECT_MIN_MS;
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[dbListener] listening on channel "${CHANNEL}"`);
  }
}

function scheduleReconnect() {
  if (stopping) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  console.warn(`[dbListener] reconnecting in ${delay}ms`);
  setTimeout(() => {
    connectAndListen().catch((err) => {
      console.error('[dbListener] reconnect failed:', err.message);
      scheduleReconnect();
    });
  }, delay).unref?.();
}

async function start() {
  stopping = false;
  await connectAndListen();
}

async function stop() {
  stopping = true;
  if (client) {
    try { await client.end(); } catch { /* ignore */ }
    client = null;
  }
}

module.exports = { start, stop };
