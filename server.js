const express    = require('express');
const compression = require('compression');
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

// ── Gzip compression ────────────────────────────────────────────────────────
app.use(compression());

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
app.listen(PORT, () => {
  console.log(`Digishot running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
