# Digishot Website

Full-service digital agency website for Digishot.io — built with HTML/CSS/JS, served by Express.

## Pages

| URL | File |
|-----|------|
| `/` | `public/index.html` |
| `/about` | `public/about.html` |
| `/pricing` | `public/pricing.html` |
| `/contact` | `public/contact.html` |
| `/blog` | `public/blog.html` |
| `/privacy` | `public/privacy.html` |
| `/terms` | `public/terms.html` |
| `/sitemap.xml` | `public/sitemap.xml` |
| `/robots.txt` | `public/robots.txt` |

## Deploy to Railway

### Option A — GitHub (recommended)

1. Push this folder to a GitHub repository
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repository
4. Railway auto-detects Node.js and runs `npm start`
5. Add a custom domain in Railway → Settings → Domains → `digishot.io`

### Option B — Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

## Environment Variables

Set these in Railway → Variables:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | Set automatically by Railway |

## Local Development

```bash
npm install
npm start
# → http://localhost:3000
```

## After Deploy

1. Submit `https://digishot.io/sitemap.xml` to [Google Search Console](https://search.google.com/search-console)
2. Run pages through [PageSpeed Insights](https://pagespeed.web.dev/)
3. Verify structured data at [Rich Results Test](https://search.google.com/test/rich-results)
