require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));

// Serve static assets (css, js, assets) from the project root
app.use(express.static(path.join(__dirname, '..')));
// Serve HTML pages from the html/ subfolder
app.use(express.static(path.join(__dirname, '..', 'html')));

// Rate limit the contact endpoint: max 5 submissions per 15 min per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.' }
});

// ── Nodemailer transport ───────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ── Helper: sanitize input ─────────────────────────────────
const sanitize = (str = '') => String(str).replace(/[<>]/g, '').trim().slice(0, 2000);

// ── POST /api/contact ─────────────────────────────────────
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { nombre, email, telefono, perfil, portfolio, mensaje } = req.body;

  if (!nombre || !email || !mensaje) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, email y mensaje.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'El correo electrónico no es válido.' });
  }

  const mailOptions = {
    from: process.env.MAIL_FROM || 'noreply@lanzaroteproducciones.com',
    to: process.env.MAIL_TO || 'info@lanzaroteproducciones.com',
    replyTo: sanitize(email),
    subject: `Nueva candidatura — ${sanitize(perfil || 'General')} | ${sanitize(nombre)}`,
    html: `
      <div style="font-family:sans-serif; max-width:600px; margin:0 auto; color:#222;">
        <div style="background:#0a0a0a; padding:24px 32px; border-bottom:3px solid #c9a96e;">
          <h2 style="color:#c9a96e; margin:0; font-size:20px; font-weight:400;">
            Nueva candidatura — Buscamos Talentos
          </h2>
        </div>
        <div style="padding:32px; background:#f9f9f9;">
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr><td style="padding:8px 0; color:#666; width:130px;">Nombre</td><td style="padding:8px 0; font-weight:500;">${sanitize(nombre)}</td></tr>
            <tr><td style="padding:8px 0; color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${sanitize(email)}" style="color:#c9a96e;">${sanitize(email)}</a></td></tr>
            <tr><td style="padding:8px 0; color:#666;">Teléfono</td><td style="padding:8px 0;">${sanitize(telefono) || '—'}</td></tr>
            <tr><td style="padding:8px 0; color:#666;">Perfil</td><td style="padding:8px 0;">${sanitize(perfil) || '—'}</td></tr>
            <tr><td style="padding:8px 0; color:#666;">Portfolio</td><td style="padding:8px 0;">${sanitize(portfolio) ? `<a href="${sanitize(portfolio)}" style="color:#c9a96e;">${sanitize(portfolio)}</a>` : '—'}</td></tr>
          </table>
          <div style="margin-top:24px; padding-top:20px; border-top:1px solid #ddd;">
            <p style="color:#666; font-size:13px; margin-bottom:8px;">Mensaje:</p>
            <p style="line-height:1.7; white-space:pre-wrap;">${sanitize(mensaje)}</p>
          </div>
        </div>
        <div style="padding:16px 32px; background:#0a0a0a; text-align:center;">
          <p style="color:#666; font-size:12px; margin:0;">Onyxay Lanzarote Producciones · info@lanzaroteproducciones.com</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: '¡Candidatura enviada! Te contactaremos pronto.' });
  } catch (err) {
    console.error('Mail error:', err.message);
    res.status(500).json({ error: 'Error al enviar el correo. Inténtalo de nuevo o escríbenos directamente.' });
  }
});

// ── Fallback: serve index.html for any unmatched route ────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Lanzarote Producciones server running`);
  console.log(`  Local: http://localhost:${PORT}\n`);
});
