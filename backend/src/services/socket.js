// ===== Socket.IO server =====
// Wraps the Express HTTP server with a Socket.IO instance, authenticates each
// connection via the same JWT used for REST, and places clients into a room
// named after their role: `role:admin`, `role:collector`, `role:cashroom`.
//
// Other modules call `broadcast(room, event, payload)` to push events out.
// The DB listener (services/dbListener.js) is the primary publisher.

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function init(httpServer) {
  if (io) return io;

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
      credentials: false,
    },
    // Long-poll fallback stays available for restrictive networks; modern
    // browsers will upgrade to websocket immediately.
    transports: ['websocket', 'polling'],
  });

  // Auth middleware — every connection must present a valid JWT. The token is
  // taken from `auth.token` (set by socket.io-client) or the `Authorization`
  // header for compatibility.
  io.use((socket, next) => {
    try {
      const raw =
        socket.handshake?.auth?.token ||
        socket.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        '';
      if (!raw) return next(new Error('missing token'));
      const payload = jwt.verify(raw, process.env.JWT_SECRET);
      if (!payload?.role) return next(new Error('invalid token payload'));
      socket.data.user = { id: payload.id, role: payload.role };
      next();
    } catch (err) {
      next(new Error('invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { role, id } = socket.data.user;
    socket.join(`role:${role}`);
    // Per-user room — lets us target a single user (e.g. private notifications,
    // collector-specific events later).
    socket.join(`user:${id}`);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[socket] connected user=${id} role=${role} sid=${socket.id}`);
    }
    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[socket] disconnected sid=${socket.id} reason=${reason}`);
      }
    });
  });

  return io;
}

/**
 * Broadcast an event to a room. Safe to call before init() — drops silently.
 * @param {string} room   e.g. 'role:admin'
 * @param {string} event  e.g. 'entity.changed'
 * @param {object} data
 */
function broadcast(room, event, data) {
  if (!io) return;
  io.to(room).emit(event, data);
}

/**
 * Broadcast to multiple rooms in one call.
 */
function broadcastMany(rooms, event, data) {
  if (!io || !rooms?.length) return;
  io.to(rooms).emit(event, data);
}

function getIO() {
  return io;
}

module.exports = { init, broadcast, broadcastMany, getIO };
