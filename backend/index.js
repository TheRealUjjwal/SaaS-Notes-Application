// backend/index.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const { tenantIsolation, enforceNoteLimit } = require('./middleware');
const { tenants, users, notes } = require('./db');
const app = express();
app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// Root endpoint for debugging
app.get('/', (req, res) => {
  res.json({ 
    message: 'Notes Backend API is running',
    endpoints: [
      'GET /api/health',
      'POST /api/login',
      'GET /api/notes',
      'POST /api/notes',
      'GET /api/notes/:id',
      'PUT /api/notes/:id',
      'DELETE /api/notes/:id',
      'POST /api/tenants/:slug/upgrade',
      'POST /api/tenants/:slug/downgrade',
      'GET /api/tenants/:slug/plan'
    ]
  });
});

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error('JWT error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Auth endpoint
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    console.error('/login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Notes CRUD (all require auth, tenant isolation)
app.get('/api/notes', authenticate, tenantIsolation, (req, res) => {
  try {
    const tenantNotes = notes.filter(n => n.tenantId === req.user.tenantId);
    res.json(tenantNotes);
  } catch (err) {
    console.error('GET /notes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/notes/:id', authenticate, tenantIsolation, (req, res) => {
  try {
    const note = notes.find(n => n.id === req.params.id && n.tenantId === req.user.tenantId);
    if (!note) return res.status(404).json({ error: 'Not found' });
    res.json(note);
  } catch (err) {
    console.error('GET /notes/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notes', authenticate, tenantIsolation, enforceNoteLimit, (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const note = { id: uuidv4(), title, content, tenantId: req.user.tenantId, createdBy: req.user.id };
    notes.push(note);
    res.status(201).json(note);
  } catch (err) {
    console.error('POST /notes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/notes/:id', authenticate, tenantIsolation, (req, res) => {
  try {
    const note = notes.find(n => n.id === req.params.id && n.tenantId === req.user.tenantId);
    if (!note) return res.status(404).json({ error: 'Not found' });
    if (note.createdBy !== req.user.id && req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    note.title = req.body.title ?? note.title;
    note.content = req.body.content ?? note.content;
    res.json(note);
  } catch (err) {
    console.error('PUT /notes/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/notes/:id', authenticate, tenantIsolation, (req, res) => {
  try {
    const idx = notes.findIndex(n => n.id === req.params.id && n.tenantId === req.user.tenantId);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const note = notes[idx];
    if (note.createdBy !== req.user.id && req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    notes.splice(idx, 1);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /notes/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Upgrade endpoint (Admin only)
app.post('/api/tenants/:slug/upgrade', authenticate, tenantIsolation, requireRole('Admin'), (req, res) => {
  try {
    const { slug } = req.params;
    if (!tenants[slug]) return res.status(404).json({ error: 'Tenant not found' });
    tenants[slug].plan = 'Pro';
    res.json({ message: 'Upgraded to Pro', plan: 'Pro' });
  } catch (err) {
    console.error('POST /tenants/:slug/upgrade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Downgrade endpoint (Admin only)
app.post('/api/tenants/:slug/downgrade', authenticate, tenantIsolation, requireRole('Admin'), (req, res) => {
  try {
    const { slug } = req.params;
    if (!tenants[slug]) return res.status(404).json({ error: 'Tenant not found' });
    tenants[slug].plan = 'Free';
    res.json({ message: 'Downgraded to Free', plan: 'Free' });
  } catch (err) {
    console.error('POST /tenants/:slug/downgrade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current plan for a tenant (for frontend plan status)
app.get('/api/tenants/:slug/plan', authenticate, (req, res) => {
  try {
    const { slug } = req.params;
    if (!tenants[slug]) return res.status(404).json({ error: 'Tenant not found' });
    // Only allow users from this tenant to see plan
    if (req.user.tenantId !== slug) return res.status(403).json({ error: 'Forbidden' });
    res.json({ plan: tenants[slug].plan });
  } catch (err) {
    console.error('GET /tenants/:slug/plan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start local dev server only if not in production
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Backend running on :${port}`));
}

module.exports = app;
