// backend/db.js
const { v4: uuidv4 } = require('uuid');

const tenants = {
  acme: { slug: 'acme', name: 'Acme', plan: 'Free' },
  globex: { slug: 'globex', name: 'Globex', plan: 'Free' }
};
const users = [
  { id: uuidv4(), email: 'admin@acme.test', password: 'password', role: 'Admin', tenantId: 'acme' },
  { id: uuidv4(), email: 'user@acme.test', password: 'password', role: 'Member', tenantId: 'acme' },
  { id: uuidv4(), email: 'admin@globex.test', password: 'password', role: 'Admin', tenantId: 'globex' },
  { id: uuidv4(), email: 'user@globex.test', password: 'password', role: 'Member', tenantId: 'globex' }
];
const notes = [];

module.exports = { tenants, users, notes };
