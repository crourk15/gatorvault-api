# GatorVault Server

Express API for member registration, sign-in, welcome emails, and digest delivery.

## Features

- `POST /api/register` — create account, enroll Beehiiv onboarding automation, return session token
- `GET /api/onboarding/sequence` — list 7-email onboarding schedule (Days 0–14)
- `POST /api/login` — sign in with email + password
- `GET /api/session` — validate session token
- `POST /api/welcome` — send branded GatorVault welcome email (no Netlify branding)
- `POST /api/trial-status` — check trial days remaining / expiry for a member
- `POST /api/digest` — forward digest to webhook/email

## Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env — set SESSION_SECRET and email provider (SMTP or SendGrid)
npm start
```

Server runs at `http://localhost:3000`.

## Onboarding emails — Beehiiv (primary) + EmailJS fallback

New members are enrolled in a **7-email Beehiiv automation** (Days 0, 1, 3, 5, 7, 10, 14). Setup: [docs/beehiiv-onboarding-setup.md](docs/beehiiv-onboarding-setup.md).

Export HTML for Beehiiv paste: `node scripts/export-onboarding-html.js`

## Email (Day 0 fallback) — EmailJS

`server/.env` is pre-created for **EmailJS + Gmail** (`gatorvaultinsider@gmail.com`). No SMTP or SendGrid.

### 1. Add your private key

```bash
cd server
# .env already exists — edit this line:
EMAILJS_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE   # ← paste real key from emailjs.com
```

### 2. EmailJS dashboard ([emailjs.com](https://www.emailjs.com))

**Email Services** → Gmail → `gatorvaultinsider@gmail.com` (`service_ul7ju9p`)

**Email Templates** → `template_okh1hj8` → paste HTML from `emailjs-welcome-template.html`:

| Field | Value |
|-------|--------|
| To email | `{{to_email}}` |
| From name | `GatorVault` |
| Subject | `Welcome to GatorVault — Your Insider Access Is Live 🐊` |

Variables: `{{to_name}}`, `{{tier_name}}`, `{{trial_end}}`, `{{login_url}}`, `{{support_x}}`

### 3. Start server

```bash
npm install
npm start
```

### 4. Verify

`http://localhost:3000/api/email-status` should return:

```json
{ "configured": true, "providers": ["emailjs"] }
```

### 5. Test signup

Create an account on the site → welcome email should arrive from GatorVault via Gmail.

### 6. Test welcome email without registering

Open **`/test-email.html`** on your deployed site (or `http://localhost:3000/test-email.html` locally).

- Enter your operator PIN (default: same as Admin Access — `GV2026admin`)
- Use any test inbox (e.g. `you+gvtest@gmail.com`)
- **Send via Browser EmailJS** — tests the same path the live site uses on static hosting
- **Send via Server API** — tests `POST /api/test/welcome` (requires Node server + `.env`)

Live server logs stream in the page when the API is running. Override PIN with `EMAIL_TEST_PIN` in `.env`.

## Trial tracking

- Each account stores `trialEnd` (ISO date, 30 days from signup) in `data/users.json`
- Login returns `402` when trial expired and no `paid` flag
- Client shows a countdown banner (last 7 days) and blocks vault content after Day 30 until payment is added

## Local testing

1. Start the server: `npm start`
2. Open `index.html` via a local static server (or the same machine at localhost)
3. Create account → welcome email sent (if configured) → immediate vault access
4. Sign out → sign in again with same credentials

## Production

- Set a strong `SESSION_SECRET`
- Use SendGrid or SMTP for real welcome emails
- Deploy API and point the site to the same origin, or set `window.GV_API_BASE` in `index.html`
- On Netlify static-only deploys without this API, sign-up falls back to Netlify Identity (if enabled)

## User data

Accounts are stored in `data/users.json` (gitignored in production — back up separately).

## Live recruiting (Phase 1)

### Setup

```bash
cd server
npm install
npm run seed:recruiting   # loads players + rankings into data/recruiting/
npm start
```

Optional Supabase: run `supabase/schema.sql` in the SQL editor, then set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`.

### API

| Endpoint | Description |
|----------|-------------|
| `GET /api/recruiting/feed` | Full board (2026/2027), portal, rankings, recent events |
| `GET /api/recruiting/board?class=2027` | Class board |
| `GET /api/recruiting/portal` | Portal incoming |
| `GET /api/recruiting/events?since=ISO` | New events for polling |
| `GET /api/players/:slug` | Player profile |
| `POST /api/recruiting/events` | Manual commit/flip alert (PIN: `GV2026admin`) |

### Admin + profiles

- **`/recruiting-admin.html`** — fire commit/flip/portal alerts manually
- **`/player/maxwell-hiller`** — stable player profile URLs (`_redirects` included)

### Netlify + Render

**Blueprint:** repo root includes `render.yaml` (`rootDir: server`). In [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint** → connect your GitHub repo → **Deploy Blueprint**. Paste secret env vars when prompted (copy from local `server/.env`).

| Render env var | Value |
|----------------|-------|
| `ON3_INGEST_ENABLED` | `true` |
| `ON3_INGEST_INTERVAL_MS` | `120000` |
| `ON3_CLASS_YEARS` | `2026,2027` |
| `EMAIL_PROVIDER` | `emailjs` |
| `EMAILJS_*` | same as local `.env` |
| `RECRUITING_ADMIN_PIN` | `GV2026admin` |

After deploy, verify:

```bash
curl https://gatorvault-api.onrender.com/api/recruiting/ingest/status
```

Expect `"enabled": true` and `"initialized": true` (baseline ships in `data/recruiting/on3-snapshot.json`).

On Netlify static site, set in `index.html` before other scripts:

```html
<script>window.GV_API_BASE='https://gatorvault-api.onrender.com';</script>
```

The vault polls `/api/recruiting/events` every 60s and refreshes boards when new commits are posted.

### Phase 2 — On3 ingest

Polls On3 Florida commit boards, diffs against a local snapshot, and auto-fires the same events as the admin panel (`source: on3`).

**First run = baseline only** (no member alerts). Saves `data/recruiting/on3-snapshot.json`. Subsequent runs detect new commits, decommits, flips, and class ranking moves.

```bash
cd server
npm run ingest:on3:baseline   # one-time: seed snapshot from live On3
npm run ingest:on3            # diff + fire events
```

**Enable in-process polling** (Render web service):

```env
ON3_INGEST_ENABLED=true
ON3_INGEST_INTERVAL_MS=120000
```

**Render cron** (recommended for production) — hit every 2 minutes:

```bash
curl -X POST https://your-app.onrender.com/api/recruiting/ingest \
  -H "X-Ingest-Secret: GV2026admin"
```

Status: `GET /api/recruiting/ingest/status`

Manual baseline reset: `POST /api/recruiting/ingest` with body `{ "baselineOnly": true, "pin": "GV2026admin" }`
