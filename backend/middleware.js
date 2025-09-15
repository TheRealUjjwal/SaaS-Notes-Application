// backend/middleware.js
const { tenants, users, notes } = require('./db');

function tenantIsolation(req, res, next) {
  const { tenantId } = req.user;
  if (!tenants[tenantId]) return res.status(403).json({ error: 'Invalid tenant' });
  req.tenant = tenants[tenantId];
  next();
}

function enforceNoteLimit(req, res, next) {
  const { tenant } = req;
  if (tenant.plan === 'Free') {
    const count = notes.filter(n => n.tenantId === tenant.slug).length;
    if (count >= 3) return res.status(402).json({ error: 'Upgrade to Pro to add more notes' });
  }
  next();
}

module.exports = { tenantIsolation, enforceNoteLimit };
