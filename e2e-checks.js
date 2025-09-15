#!/usr/bin/env node
// Automated end-to-end checks for SaaS Notes App
const fetch = require('node-fetch');

const API = 'http://localhost:3001';
const users = [
  { email: 'admin@acme.test', password: 'password', role: 'Admin', tenant: 'acme' },
  { email: 'user@acme.test', password: 'password', role: 'Member', tenant: 'acme' },
  { email: 'admin@globex.test', password: 'password', role: 'Admin', tenant: 'globex' },
  { email: 'user@globex.test', password: 'password', role: 'Member', tenant: 'globex' }
];

async function main() {
  // 1. Health endpoint
  const health = await fetch(API + '/health').then(r => r.json());
  console.log('Health:', health);

  // 2. Login for all users
  const tokens = {};
  for (const u of users) {
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password })
    });
    const data = await res.json();
    tokens[u.email] = data.token;
    console.log(`Login for ${u.email}:`, data.token ? 'OK' : 'FAIL', data.token ? '' : data);
  }

  // 3. Tenant isolation: Acme Admin creates a note, Globex cannot see it
  const acmeAdminToken = tokens['admin@acme.test'];
  const globexAdminToken = tokens['admin@globex.test'];
  const noteRes = await fetch(API + '/notes', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + acmeAdminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Acme Note', content: 'Secret' })
  });
  const note = await noteRes.json();
  console.log('Acme Admin created note:', note.id ? 'OK' : 'FAIL', note);
  const globexNotes = await fetch(API + '/notes', {
    headers: { 'Authorization': 'Bearer ' + globexAdminToken }
  }).then(r => r.json());
  const found = globexNotes.find(n => n.id === note.id);
  console.log('Globex Admin sees Acme note:', found ? 'FAIL' : 'OK');

  // 4. Role-based restrictions: Member cannot upgrade
  const acmeMemberToken = tokens['user@acme.test'];
  const upgradeRes = await fetch(API + '/tenants/acme/upgrade', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + acmeMemberToken }
  });
  console.log('Member upgrade attempt:', upgradeRes.status === 403 ? 'OK' : 'FAIL', await upgradeRes.json());

  // 5. Free plan note limit (3), upgrade removes limit
  // Delete all notes for clean test
  let acmeNotes = await fetch(API + '/notes', { headers: { 'Authorization': 'Bearer ' + acmeAdminToken } }).then(r => r.json());
  for (const n of acmeNotes) {
    await fetch(API + '/notes/' + n.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + acmeAdminToken } });
  }
  // Create 3 notes (should succeed)
  let limitOk = true;
  for (let i = 1; i <= 3; ++i) {
    const res = await fetch(API + '/notes', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + acmeAdminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Note ' + i, content: '...' })
    });
    if (res.status !== 201) limitOk = false;
  }
  // 4th note (should fail)
  const res4 = await fetch(API + '/notes', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + acmeAdminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Note 4', content: '...' })
  });
  console.log('Free plan note limit enforced:', res4.status === 403 && limitOk ? 'OK' : 'FAIL');
  // Upgrade to Pro
  await fetch(API + '/tenants/acme/upgrade', { method: 'POST', headers: { 'Authorization': 'Bearer ' + acmeAdminToken } });
  // 4th note (should now succeed)
  const res4pro = await fetch(API + '/notes', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + acmeAdminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Note 4', content: '...' })
  });
  console.log('Pro plan removes note limit:', res4pro.status === 201 ? 'OK' : 'FAIL');

  // 6. CRUD endpoints
  // Create
  const crudNote = await fetch(API + '/notes', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + acmeAdminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'CRUD Note', content: 'C' })
  }).then(r => r.json());
  // Read
  const readNote = await fetch(API + '/notes/' + crudNote.id, { headers: { 'Authorization': 'Bearer ' + acmeAdminToken } }).then(r => r.json());
  // Update
  await fetch(API + '/notes/' + crudNote.id, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + acmeAdminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'CRUD Note Updated' })
  });
  // Delete
  await fetch(API + '/notes/' + crudNote.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + acmeAdminToken } });
  const afterDelete = await fetch(API + '/notes/' + crudNote.id, { headers: { 'Authorization': 'Bearer ' + acmeAdminToken } });
  console.log('CRUD endpoints:', readNote.id && afterDelete.status === 404 ? 'OK' : 'FAIL');

  // 7. Frontend presence (basic check)
  try {
    const frontend = await fetch('http://localhost:3000');
    console.log('Frontend accessible:', frontend.status === 200 ? 'OK' : 'FAIL');
  } catch (e) {
    console.log('Frontend accessible: FAIL', e.message);
  }
}

main();
