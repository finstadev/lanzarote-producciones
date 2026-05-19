require('dotenv').config();
const express  = require('express');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Lead storage (JSON file) ───────────────────────────────
const DATA_DIR  = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]');

function readLeads() {
  try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); }
  catch { return []; }
}

function writeLead(lead) {
  const leads = readLeads();
  lead.id = leads.length ? Math.max(...leads.map(l => l.id)) + 1 : 1;
  lead.starred  = false;
  lead.archived = false;
  leads.unshift(lead);
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  return lead;
}

function updateLead(id, updates) {
  const leads = readLeads();
  const idx   = leads.findIndex(l => l.id === Number(id));
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...updates };
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  return leads[idx];
}

// ── Admin sessions (in-memory, 24 h) ──────────────────────
const sessions = new Map();

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}

function requireAdmin(req, res, next) {
  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  const exp  = sessions.get(auth);
  if (!exp || exp < Date.now()) {
    sessions.delete(auth);
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.static(path.join(__dirname, '..')));
app.use(express.static(path.join(__dirname, '..', 'html')));

// ── Rate limiters ──────────────────────────────────────────
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { error: 'Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.' }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' }
});

// ── Nodemailer ─────────────────────────────────────────────
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

// ── Helper ─────────────────────────────────────────────────
const sanitize = (str = '') => String(str).replace(/[<>]/g, '').trim().slice(0, 2000);

// ── POST /api/contact ─────────────────────────────────────
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { nombre, email, telefono, perfil, portfolio, mensaje } = req.body;

  if (!nombre || !email || !mensaje)
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, email y mensaje.' });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'El correo electrónico no es válido.' });

  const lead = writeLead({
    createdAt:  new Date().toISOString(),
    tipo:       'candidatura',
    nombre:     sanitize(nombre),
    email:      sanitize(email),
    telefono:   sanitize(telefono),
    perfil:     sanitize(perfil),
    portfolio:  sanitize(portfolio),
    mensaje:    sanitize(mensaje),
    ip:         (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
  });

  if (transporter) {
    try {
      await transporter.sendMail({
        from:    process.env.MAIL_FROM || 'noreply@lanzaroteproducciones.com',
        to:      process.env.MAIL_TO   || 'info@lanzaroteproducciones.com',
        replyTo: lead.email,
        subject: `Nueva candidatura — ${lead.perfil || 'General'} | ${lead.nombre}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222;">
            <div style="background:#0a0a0a;padding:24px 32px;border-bottom:3px solid #2041c8;">
              <h2 style="color:#fff;margin:0;font-size:18px;font-weight:400;">
                Nueva candidatura — Buscamos Talentos
              </h2>
            </div>
            <div style="padding:32px;background:#f9f9f9;">
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#666;width:130px;">Nombre</td><td style="padding:8px 0;font-weight:500;">${lead.nombre}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${lead.email}" style="color:#2041c8;">${lead.email}</a></td></tr>
                <tr><td style="padding:8px 0;color:#666;">Teléfono</td><td style="padding:8px 0;">${lead.telefono || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Perfil</td><td style="padding:8px 0;">${lead.perfil || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Portfolio</td><td style="padding:8px 0;">${lead.portfolio ? `<a href="${lead.portfolio}" style="color:#2041c8;">${lead.portfolio}</a>` : '—'}</td></tr>
              </table>
              <div style="margin-top:24px;padding-top:20px;border-top:1px solid #ddd;">
                <p style="color:#666;font-size:13px;margin-bottom:8px;">Mensaje:</p>
                <p style="line-height:1.7;white-space:pre-wrap;">${lead.mensaje}</p>
              </div>
            </div>
            <div style="padding:16px 32px;background:#0a0a0a;text-align:center;">
              <p style="color:#666;font-size:12px;margin:0;">Lead #${lead.id} · Onyxay Lanzarote Producciones</p>
            </div>
          </div>`
      });
    } catch (err) {
      console.error('Mail error:', err.message);
    }
  }

  res.json({ message: '¡Candidatura enviada! Te contactaremos pronto.' });
});

// ── POST /api/admin/login ─────────────────────────────────
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  res.json({ token: createSession() });
});

// ── GET /api/admin/leads ──────────────────────────────────
app.get('/api/admin/leads', requireAdmin, (req, res) => {
  const all      = readLeads();
  const active   = all.filter(l => !l.archived);
  const archived = all.filter(l =>  l.archived);
  const now      = new Date();
  const today    = now.toISOString().slice(0, 10);
  const weekAgo  = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  res.json({
    leads:    active,
    archived: archived,
    stats: {
      total:    active.length,
      today:    active.filter(l => l.createdAt?.startsWith(today)).length,
      thisWeek: active.filter(l => l.createdAt >= weekAgo).length,
      starred:  active.filter(l => l.starred).length
    }
  });
});

// ── PUT /api/admin/leads/:id/star ─────────────────────────
app.put('/api/admin/leads/:id/star', requireAdmin, (req, res) => {
  const leads = readLeads();
  const lead  = leads.find(l => l.id === Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
  const updated = updateLead(req.params.id, { starred: !lead.starred });
  res.json({ ok: true, starred: updated.starred });
});

// ── DELETE /api/admin/leads/:id  (soft archive) ───────────
app.delete('/api/admin/leads/:id', requireAdmin, (req, res) => {
  updateLead(req.params.id, { archived: true, archivedAt: new Date().toISOString() });
  res.json({ ok: true });
});

// ── PUT /api/admin/leads/:id/restore ─────────────────────
app.put('/api/admin/leads/:id/restore', requireAdmin, (req, res) => {
  updateLead(req.params.id, { archived: false, archivedAt: null });
  res.json({ ok: true });
});

// ── Admin panel ────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'admin.html'));
});

// ── Fallback ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'index.html'));
});

// ── Debug (remove after confirming env vars work) ─────────
app.get('/api/debug', (req, res) => {
  res.json({
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
    adminPasswordLength: (process.env.ADMIN_PASSWORD || '').length
  });
});

app.listen(PORT, () => {
  console.log(`\n  Lanzarote Producciones — http://localhost:${PORT}`);
  console.log(`  Admin panel          — http://localhost:${PORT}/admin`);
  console.log(`  ADMIN_PASSWORD set:  ${!!process.env.ADMIN_PASSWORD}\n`);
});
