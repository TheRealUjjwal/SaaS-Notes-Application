// backend/test/api.test.js
const request = require('supertest');
const { app, JWT_SECRET } = require('../index');
const { tenants, users, notes } = require('../db');
const jwt = require('jsonwebtoken');

describe('SaaS Notes API', () => {
  let adminToken, memberToken, adminGlobexToken;
  beforeAll(() => {
    const acmeAdmin = users.find(u => u.email === 'admin@acme.test');
    const acmeMember = users.find(u => u.email === 'user@acme.test');
    const globexAdmin = users.find(u => u.email === 'admin@globex.test');
    adminToken = jwt.sign({ id: acmeAdmin.id, email: acmeAdmin.email, role: acmeAdmin.role, tenantId: acmeAdmin.tenantId }, JWT_SECRET);
    memberToken = jwt.sign({ id: acmeMember.id, email: acmeMember.email, role: acmeMember.role, tenantId: acmeMember.tenantId }, JWT_SECRET);
    adminGlobexToken = jwt.sign({ id: globexAdmin.id, email: globexAdmin.email, role: globexAdmin.role, tenantId: globexAdmin.tenantId }, JWT_SECRET);
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /login authenticates test accounts', async () => {
    const res = await request(app).post('/login').send({ email: 'admin@acme.test', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('enforces tenant isolation', async () => {
    // Create a note as Acme admin
    const noteRes = await request(app)
      .post('/notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Acme Note', content: 'Secret' });
    expect(noteRes.status).toBe(201);
    // Try to access as Globex admin
    const getRes = await request(app)
      .get(`/notes/${noteRes.body.id}`)
      .set('Authorization', `Bearer ${adminGlobexToken}`);
    expect(getRes.status).toBe(404);
  });

  it('enforces role-based restrictions', async () => {
    // Member cannot upgrade
    const res = await request(app)
      .post('/tenants/acme/upgrade')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it('enforces Free plan note limit and allows upgrade', async () => {
    // Create 2 more notes (already 1 created above)
    await request(app).post('/notes').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Note2' });
    await request(app).post('/notes').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Note3' });
    // 4th note should fail
    const res = await request(app).post('/notes').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Note4' });
    expect(res.status).toBe(402);
    // Upgrade
    const upgrade = await request(app).post('/tenants/acme/upgrade').set('Authorization', `Bearer ${adminToken}`);
    expect(upgrade.status).toBe(200);
    // Now 4th note should succeed
    const res2 = await request(app).post('/notes').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Note4' });
    expect(res2.status).toBe(201);
  });

  it('CRUD endpoints work as expected', async () => {
    // Create
    const create = await request(app).post('/notes').set('Authorization', `Bearer ${adminGlobexToken}`).send({ title: 'Globex Note' });
    expect(create.status).toBe(201);
    const noteId = create.body.id;
    // Read
    const get = await request(app).get(`/notes/${noteId}`).set('Authorization', `Bearer ${adminGlobexToken}`);
    expect(get.status).toBe(200);
    // Update
    const update = await request(app).put(`/notes/${noteId}`).set('Authorization', `Bearer ${adminGlobexToken}`).send({ title: 'Updated' });
    expect(update.status).toBe(200);
    expect(update.body.title).toBe('Updated');
    // Delete
    const del = await request(app).delete(`/notes/${noteId}`).set('Authorization', `Bearer ${adminGlobexToken}`);
    expect(del.status).toBe(204);
  });
});
