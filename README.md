# GatorVault API

Monorepo-style layout for **GatorVault Insider** — Express API, static site, On3 ingest, media pipeline, and X AutoPoster for [@gatorvault](https://x.com/gatorvault).

## Project structure

```
gatorvault-api/
├── README.md              ← you are here
├── package.json           ← root scripts (delegates to server/)
├── render.yaml            ← Render.com deploy (API)
├── netlify.toml           ← Netlify deploy (static site from server/)
├── client/                ← pointer docs (frontend lives in server/ today)
└── server/                ← Node app + static HTML/CSS/JS + data
    ├── package.json
    ├── server.js
    ├── index.html         ← main site
    ├── lib/               ← API modules
    ├── data/              ← JSON stores
    ├── scripts/           ← ingest, verify, seed CLIs
    └── docs/              ← setup guides
```

> **Note:** There is no separate TypeScript/React build step. The “client” is vanilla HTML served by Express and published to Netlify from `server/`. Run everything from the repo root with `npm install && npm start`.

## Quick start (local)

```bash
git clone https://github.com/crourk15/gatorvault-api.git
cd gatorvault-api
npm install          # installs server/ dependencies
cp server/.env.example server/.env
# Edit server/.env — SESSION_SECRET, EmailJS, X OAuth keys (see server/docs/)
npm start            # http://localhost:3000
```

## Scripts (from repo root)

| Command | Description |
|---------|-------------|
| `npm start` | Start Express on port 3000 |
| `npm run dev` | Start with nodemon |
| `npm run ingest:on3` | Run On3 recruiting ingest once |
| `npm run verify:x` | Verify X AutoPoster OAuth credentials |
| `npm run run:x-autoposter` | Refill queue + process due posts once |
| `npm run ingest:media` | Run highlight/interview media ingest |

## Deploy targets

| Service | Config | What runs |
|---------|--------|-----------|
| **Render** | `render.yaml` → `rootDir: server` | API, cron ingest, X AutoPoster |
| **Netlify** | `netlify.toml` → `publish = server` | Static site (index.html, assets) |

Production API: `https://gatorvault-api.onrender.com`  
Production site: `https://gatorvaultinsider.com`

## Environment variables

Copy `server/.env.example` → `server/.env`. Key groups:

- **Core:** `PORT`, `SITE_URL`, `SESSION_SECRET`
- **Email:** `EMAILJS_*` (welcome emails)
- **On3 ingest:** `ON3_INGEST_ENABLED`, `ON3_CLASS_YEARS`
- **X AutoPoster:** `X_OAUTH1_*` or `TWITTER_*`, `X_AUTOPOST_ENABLED`
- **Live beat:** `X_BEARER_TOKEN` (read-only stream, separate from posting keys)

Full guides: [server/README.md](server/README.md), [server/docs/x-autoposter-setup.md](server/docs/x-autoposter-setup.md)

## Health checks

```bash
curl http://localhost:3000/api/recruiting/ingest/status
curl http://localhost:3000/api/x/autoposter/status
curl http://localhost:3000/api/email-status
```

## Multiple folders on your machine?

Use **one** clone at a known path, e.g. `Desktop/gatorvault-api`. The repo root should contain this README, `package.json`, `render.yaml`, and the `server/` folder. If you only see `server/` without a root README, you may have opened the wrong directory or an old partial copy — delete extras and re-clone from GitHub.
