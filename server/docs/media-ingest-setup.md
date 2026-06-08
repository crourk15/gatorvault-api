# Highlight + Interview Ingestion Pipeline

Automated pipeline that discovers Gators video from approved sources, trims to target length, applies GatorVault ESPN-style branding, and publishes to Film Room.

## What it does

```
Sources → Discover → Queue → Download → Trim → Brand → Catalog → Film Room API
```

| Stage | Output |
|-------|--------|
| **Discover** | New items in `data/media-ingest/queue.json` |
| **Process** | Branded MP4 in `media/highlights/` or `media/interviews/` |
| **Catalog** | Entry appended to `data/highlights/clips.json` or `data/interviews/clips.json` |
| **Serve** | `/api/highlights/*`, `/api/interviews/*`, `/api/film-room/feed` |

### Branding (ffmpeg)

Every processed clip gets:

1. **2s GatorVault slate** — gator blue background, orange accent bar, title + subtitle
2. **Trimmed body** — intro/outro skipped, clipped to target duration
3. **ESPN-style lower third** — title + game line for the full clip
4. **Poster frame** — JPG thumbnail from video at ~3s

**Highlight targets:** 10–30 seconds  
**Interview targets:** 20–60 seconds

### Blocked by design

- YouTube / youtu.be URLs (including compilations)
- Re-processing the same source ID twice (`data/media-ingest/seen.json`)

---

## What we need from you

### 1. Licensed source material (required)

The pipeline can **format** video; it cannot legally source SEC Network, ESPN, or broadcast footage without your rights. Please confirm one or more of:

| Source | What to provide |
|--------|-----------------|
| **UF Athletics / Sidearm** | Direct MP4 URLs, RSS feed with enclosures, or a drop folder of official packages |
| **SEC Network pressers** | Licensed MP4 downloads or a feed URL you are authorized to republish |
| **Practice availability** | Raw MP4s from your videographer or UF media relations |
| **UF social (@GatorsFB, @FloridaGators)** | Enable `x_timeline` sources + `X_BEARER_TOKEN` (native X video only) |
| **Your editor exports** | Drop finished or raw cuts into the inbox folders (fastest path to launch) |

**Important:** “Remove watermarks” only applies to sources you own or are licensed to re-edit. Do not expect the pipeline to strip third-party network bugs from unlicensed feeds.

### 2. ffmpeg on the server (required for processing)

Render’s default Node runtime does **not** include ffmpeg. Options:

- **Docker deploy** with `ffmpeg` in the image (recommended for production)
- **Local / CI processing** — run ingest locally, commit MP4s, deploy static assets
- **Dedicated worker** with ffmpeg installed

Verify locally:

```bash
ffmpeg -version
cd server && npm run ingest:media
```

### 3. Example clips (strongly recommended)

Provide **2–3 reference files** so we can tune trim/branding:

- One **10–30s game highlight** (ideal length, clean audio)
- One **20–60s press conference bite** (intro/outro pattern you want removed)
- Optional: one **social clip** from @GatorsFB

Place in:

```
server/media/ingest/inbox/highlights/
server/media/ingest/inbox/interviews/
```

With a matching `.meta.json` sidecar (see `example.meta.json` in each inbox folder).

### 4. Metadata conventions

Sidecar schema (`your-clip.mp4` + `your-clip.meta.json`):

```json
{
  "title": "Boireau Seals It: Swamp Erupts",
  "dek": "Game-winning interception with 21 seconds left.",
  "gameLine": "UF 23, Miss State 21 · Oct 2025",
  "category": "Defensive Moment",
  "season": "2025",
  "playerSlugs": ["demarkcus-boireau"],
  "gameSlug": "uf-miss-state-2025",
  "featured": true
}
```

`playerSlugs` and `gameSlug` power player profile and game page integration.

### 5. Environment variables

```env
MEDIA_INGEST_ENABLED=true
MEDIA_INGEST_INTERVAL_MS=900000
MEDIA_INGEST_BOOT_DELAY_MS=45000
MEDIA_INGEST_BATCH_LIMIT=5
MEDIA_INGEST_PIN=GV2026admin

# For @GatorsFB / @FloridaGators discovery
X_BEARER_TOKEN=your_twitter_api_v2_bearer_token

# Optional CDN override for absolute stream URLs
MEDIA_CDN_BASE=https://gatorvault-api.onrender.com
```

### 6. Source configuration

Edit `data/media-ingest/sources.json`:

- **`inbox`** — enabled by default; drop MP4s in configured folders
- **`rss`** — set `enabled: true` + Sidearm/UF RSS URL when confirmed
- **`x_timeline`** — set `enabled: true` + handle; requires `X_BEARER_TOKEN`
- **`url_list`** — paste direct MP4 URLs for SEC pressers or one-off packages

---

## API reference

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/media-ingest/status` | Pipeline health, queue counts, ffmpeg |
| `GET` | `/api/media-ingest/queue` | Queue items (`?status=pending`) |
| `GET` | `/api/media-ingest/sources` | Configured sources |
| `POST` | `/api/media-ingest/run` | Run discover + process (PIN required) |
| `GET` | `/api/film-room/feed` | Unified highlights + interviews |
| `GET` | `/api/interviews/clips` | Interview catalog |
| `GET` | `/api/players/:slug/media` | Highlights + interviews for a player |

### Manual run

```bash
cd server
npm run ingest:media
npm run ingest:media -- --discover-only
curl -X POST http://localhost:3000/api/media-ingest/run \
  -H "Content-Type: application/json" \
  -H "X-Media-Ingest-Pin: GV2026admin" \
  -d '{"limit":3}'
```

---

## Integration map

| Surface | Endpoint / behavior |
|---------|---------------------|
| **Film Room tab** | Existing `GET /api/highlights/clips` — ingested clips auto-appear |
| **Interviews** (new) | `GET /api/interviews/clips` |
| **Player profiles** | `GET /api/players/:slug/media?player=:slug` |
| **Game pages** | `GET /api/highlights/clips?gameSlug=...` + interviews same filter |
| **Unified feed** | `GET /api/film-room/feed?kind=all&playerSlug=...` |

Frontend wiring for interviews tab and player/game modules can follow in a separate UI pass.

---

## File layout

```
server/
  data/
    highlights/clips.json       # highlight catalog
    interviews/clips.json       # interview catalog
    media-ingest/
      sources.json              # source definitions
      queue.json                # processing queue (runtime)
      seen.json                 # dedup IDs (runtime)
      log.json                  # ingest log (runtime)
  media/
    ingest/inbox/highlights/    # drop raw highlights here
    ingest/inbox/interviews/    # drop raw interviews here
    ingest/raw/                 # downloaded copies (runtime)
    ingest/work/                # ffmpeg temp (runtime)
    highlights/                 # published highlights
    interviews/                 # published interviews
  lib/
    media-ingest.js             # orchestrator
    media-ingest-discover.js    # source discovery
    media-ingest-processor.js   # download + brand
    media-brand.js              # ffmpeg slate + lower third
    media-ingest-store.js       # queue + catalog writes
    media-ingest-routes.js      # API routes
```

---

## Recommended launch sequence

1. **You provide** 2–3 example MP4s + sidecars in inbox folders  
2. **We enable** ffmpeg on Render (Docker) or run ingest locally  
3. **Run** `npm run ingest:media` and verify `/api/film-room/feed`  
4. **Tune** trim durations / skip intro-outro in `sources.json`  
5. **Enable** RSS and X sources once licensing + tokens are confirmed  
6. **Set** `MEDIA_INGEST_ENABLED=true` for automatic polling  

---

## Legal note

Only ingest content you have rights to republish. GatorVault branding does not grant distribution rights for SEC, ESPN, or third-party network footage.
