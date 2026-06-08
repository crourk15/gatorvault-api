# GatorVault X AutoPoster — OAuth 1.0a Setup

Post on behalf of **@gatorvault** using OAuth 1.0a user context only.

> **Do not use Bearer tokens or OAuth 2.0 for posting.** The live beat reader (`live-beat.js`) may still use `X_BEARER_TOKEN` for read-only timelines — that is separate from AutoPoster.

## Render environment variables

Add to **gatorvault-api** on Render:

| Variable | Description |
|----------|-------------|
| `X_OAUTH1_API_KEY` | Consumer API Key |
| `X_OAUTH1_API_SECRET` | Consumer API Secret (Client Secret) |
| `X_OAUTH1_ACCESS_TOKEN` | Access Token |
| `X_OAUTH1_ACCESS_TOKEN_SECRET` | Access Token Secret |
| `X_AUTOPOST_ENABLED` | `true` to run scheduled queue processor |
| `X_AUTOPOST_INTERVAL_MS` | Poll interval (default `60000`) |
| `X_AUTOPOST_ACCOUNT` | Expected screen name (default `gatorvault`) |
| `X_AUTOPOST_PIN` | Admin PIN for post/queue routes (defaults to `RECRUITING_ADMIN_PIN`) |
| `X_AUTOPOST_CRON_SECRET` | Optional secret for `POST /api/x/autoposter/run` |

## Local verify

```bash
cd server
# Add keys to .env (see .env.example)
node scripts/verify-x-autoposter.js
```

Verify only (no tweet):

```bash
node scripts/verify-x-autoposter.js
```

Send a live test tweet:

```bash
node scripts/verify-x-autoposter.js --post "GatorVault AutoPoster test — OAuth 1.0a wired ✓"
```

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/x/autoposter/status` | — | Config + optional `?probe=1` credential check |
| `POST` | `/api/x/autoposter/verify` | PIN | Force OAuth verify |
| `POST` | `/api/x/autoposter/post` | PIN | Immediate post (`dryRun: true` to verify only) |
| `GET` | `/api/x/autoposter/queue` | PIN | List scheduled posts |
| `POST` | `/api/x/autoposter/queue` | PIN | Schedule post `{ text, scheduledAt }` |
| `DELETE` | `/api/x/autoposter/queue/:id` | PIN | Cancel pending post |
| `POST` | `/api/x/autoposter/run` | PIN or cron secret | Process due scheduled posts |

### Example — schedule a post

```bash
curl -X POST https://gatorvault-api.onrender.com/api/x/autoposter/queue \
  -H "Content-Type: application/json" \
  -d '{"pin":"GV2026admin","text":"Portal update live on GatorVault 🐊 gatorvaultinsider.com","scheduledAt":"2026-06-09T14:00:00Z"}'
```

### Example — immediate test post (dry run)

```bash
curl -X POST https://gatorvault-api.onrender.com/api/x/autoposter/post \
  -H "Content-Type: application/json" \
  -d '{"pin":"GV2026admin","text":"Test","dryRun":true}'
```

## Scheduler

When `X_AUTOPOST_ENABLED=true`, the server polls the queue every `X_AUTOPOST_INTERVAL_MS` and posts items where `scheduledAt <= now` and `status=pending`.

Queue persisted at `server/data/x/autoposter-queue.json`.

## Security

- Never commit OAuth keys to git — use Render env vars / local `.env` only.
- Rotate keys if exposed in chat or logs.
- App permissions must be **Read and Write** with user auth enabled for @gatorvault.
