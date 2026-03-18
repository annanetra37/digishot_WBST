const express    = require('express');
const compression = require('compression');
const { Resend }  = require('resend');
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

// ── Gzip compression ────────────────────────────────────────────────────────
app.use(compression());

// ── Request logging ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ── Security & SEO headers ───────────────────────────────────────────────────
app.use((req, res, next) => {
  // Tell browsers this site should only be served over HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Redirect www → non-www (Railway custom domain) ──────────────────────────
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) {
    return res.redirect(301, `https://${host.slice(4)}${req.url}`);
  }
  next();
});

// ── Force HTTPS in production ────────────────────────────────────────────────
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// ── Clean URL routing (remove .html extension) ──────────────────────────────
// Redirect /about.html → /about
app.use((req, res, next) => {
  if (req.path.endsWith('.html') && req.path !== '/index.html') {
    const clean = req.path.slice(0, -5);
    const qs    = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return res.redirect(301, clean + qs);
  }
  next();
});

// ── JSON body parser ────────────────────────────────────────────────────────
app.use(express.json());

// ── Contact form endpoint ───────────────────────────────────────────────────
let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('Resend email service initialized');
} else {
  console.warn('WARNING: RESEND_API_KEY not set — contact form emails will not be sent');
}

app.post('/api/contact', async (req, res) => {
  console.log('[Contact] Received submission');

  if (!resend) {
    console.error('[Contact] Resend not configured — RESEND_API_KEY is missing');
    return res.status(500).json({ error: 'Email service is not configured. Please contact us directly.' });
  }

  const { firstName, lastName, email, phone, company, services, message } = req.body;

  if (!firstName || !email || !message) {
    console.log('[Contact] Validation failed — missing fields');
    return res.status(400).json({ error: 'First name, email, and message are required.' });
  }

  const selectedServices = Array.isArray(services) ? services.join(', ') : (services || 'None');
  console.log(`[Contact] From: ${firstName} ${lastName || ''} <${email}> — Services: ${selectedServices}`);

  const htmlBody = `
    <h2>New Contact Form Submission</h2>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${firstName} ${lastName || ''}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${phone || 'Not provided'}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${company || 'Not provided'}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Services</td><td style="padding:8px;border-bottom:1px solid #eee;">${selectedServices}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${message}</td></tr>
    </table>
  `;

  try {
    console.log('[Contact] Sending email via Resend...');
    const { data, error } = await resend.emails.send({
      from: 'Digishot Contact <onboarding@resend.dev>',
      to: ['megh1_hri@hotmail.com', 'mherdavidian@hotmail.com'],
      replyTo: email,
      subject: `New Inquiry from ${firstName} ${lastName || ''} — Digishot Contact Form`,
      html: htmlBody,
    });

    if (error) {
      console.error('[Contact] Resend error:', error);
      return res.status(500).json({ error: 'Failed to send message. Please try again later.' });
    }

    console.log('[Contact] Email sent successfully, id:', data?.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Contact] Email send error:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
});

// ── Static files with cache headers ─────────────────────────────────────────
app.use(express.static(PUBLIC, {
  // HTML files: no cache (always revalidate)
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.endsWith('.xml') || filePath.endsWith('.txt')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else {
      // Assets: cache for 1 year
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// ── Clean URL handler (serve /about → /about.html) ──────────────────────────
app.get('*', (req, res, next) => {
  // Strip query string from path check
  const urlPath = req.path;

  // Candidates to try
  const candidates = [
    path.join(PUBLIC, urlPath + '.html'),
    path.join(PUBLIC, urlPath, 'index.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(candidate);
    }
  }

  next();
});

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  const notFoundPage = path.join(PUBLIC, '404.html');
  res.status(404);
  if (fs.existsSync(notFoundPage)) {
    return res.sendFile(notFoundPage);
  }
  // Fallback inline 404
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 — Page Not Found | Digishot</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    body { font-family: 'Outfit', sans-serif; background: #faf9f6; color: #0f1c2e;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; text-align: center; padding: 2rem; }
    .wrap { max-width: 480px; }
    .code { font-size: 6rem; font-weight: 900; color: #0a2342; line-height: 1; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
    p  { color: #4a5568; margin-bottom: 2rem; }
    a  { display: inline-block; background: #c8410a; color: #fff;
         padding: 0.75rem 2rem; border-radius: 8px; text-decoration: none;
         font-weight: 600; }
    a:hover { background: #a83408; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="code">404</div>
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <a href="/">Back to Home</a>
  </div>
</body>
</html>`);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Digishot running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
