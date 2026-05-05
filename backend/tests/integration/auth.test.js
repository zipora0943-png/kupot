// Integration tests for /api/auth — require a real PostgreSQL DB.
// Run: RUN_DB_TESTS=true npm test
const request = require('supertest');
const bcrypt  = require('bcryptjs');
const { pool, describeDb, resetDb } = require('./_helpers');

// Ensure JWT_SECRET is set for app boot (some test environments may lack it)
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';

const app = require('../../src/index');

async function createUser({ username, password, role = 'admin', active = true }) {
  const hash = await bcrypt.hash(password, 4); // low cost for fast tests
  const { rows } = await pool.query(
    `INSERT INTO users (name, username, password_hash, role, active)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [username, username, hash, role, active]
  );
  return rows[0].id;
}

describeDb('POST /api/auth/login', () => {
  beforeEach(async () => {
    await resetDb();
    await createUser({ username: 'alice', password: 'pa55w0rd' });
  });

  test('returns 200 + token on correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'pa55w0rd' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'alice', role: 'admin' });
  });

  test('401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'WRONG' });
    expect(res.status).toBe(401);
  });

  test('401 on unknown username (same response as wrong password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  test('401 for deactivated user', async () => {
    await pool.query(`UPDATE users SET active = FALSE WHERE username = 'alice'`);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'pa55w0rd' });
    expect(res.status).toBe(401);
  });

  test('400 on missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('400 when password is not a string (e.g. NoSQL injection style)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describeDb('GET /api/auth/me', () => {
  let token;
  beforeEach(async () => {
    await resetDb();
    await createUser({ username: 'bob', password: 'pw123456' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'pw123456' });
    token = res.body.token;
  });

  test('returns the authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('bob');
  });

  test('401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
  });
});

describeDb('POST /api/auth/change-password', () => {
  let token;
  beforeEach(async () => {
    await resetDb();
    await createUser({ username: 'carol', password: 'oldPassw0rd' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'carol', password: 'oldPassw0rd' });
    token = res.body.token;
  });

  test('changes password when current is correct', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'oldPassw0rd', new_password: 'newPassw0rd' });
    expect(res.status).toBe(200);

    // old password no longer works
    const reLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'carol', password: 'oldPassw0rd' });
    expect(reLogin.status).toBe(401);

    // new password works
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'carol', password: 'newPassw0rd' });
    expect(newLogin.status).toBe(200);
  });

  test('401 when current password is wrong', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'WRONG', new_password: 'newPassw0rd' });
    expect(res.status).toBe(401);
  });

  test('400 when new password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'oldPassw0rd', new_password: '123' });
    expect(res.status).toBe(400);
  });
});
