const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string'
      || !username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, role, password_hash, active
         FROM users WHERE username = $1`,
      [username]
    );
    const user = rows[0];

    // constant-time-ish: always run bcrypt.compare even when user not found,
    // to avoid leaking which usernames exist via timing.
    const dummyHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8HGZbk7eQ6oIBDlfXxKt39kQtZ7nKO';
    const hash = user ? user.password_hash : dummyHash;
    const valid = await bcrypt.compare(password, hash);

    if (!user || !user.active || !valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Task 50: include user.permissions so the client knows which optional
    // collector capabilities (e.g. can_self_report_tasks) are enabled.
    const { rows: permRows } = await pool.query(
      `SELECT permissions FROM users WHERE id = $1`, [user.id]
    );
    const permissions = permRows[0]?.permissions || {};

    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, permissions },
    });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, username, role, area_assignments, area_exclusions, active, permissions
         FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/auth/change-password — authenticated user changes their own password
router.post('/change-password', authenticate, async (req, res, next) => {
  const { current_password, new_password } = req.body || {};
  if (typeof current_password !== 'string' || typeof new_password !== 'string') {
    return res.status(400).json({ error: 'current_password and new_password required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'new_password must be at least 6 characters' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1 AND active = TRUE`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [newHash, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
