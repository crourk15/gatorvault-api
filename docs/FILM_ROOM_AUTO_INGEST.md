# Film Room auto-ingest (YouTube)

## Structure

| Hub | Source |
|---|---|
| **UF Press Conferences** | YouTube RSS: Florida Gators athletics channel (football pressers only) + YouTube search for Florida football press / Media Days |
| **GNFP Film Review** | YouTube RSS: GNFP channel |
| **Scheme School** | Curated lessons in code (`scheme-school-data.ts`) — not YouTube auto |
| **Highlights / Film Guy** | Manual `server/data/film-room/manual.json` when needed |

Catalog API: `GET /api/film-room/catalog`  
Cache: repo seed `server/data/film-room/cache.json` + durable overlay `/var/data/film-room/cache.json` on Render.

## Automatic sync

- Endpoint: `POST /api/film-room/admin/sync-youtube` (cron secret or admin PIN)
- Render cron: `gatorvault-api-film-room-youtube-sync` every **3 hours**
- Local/on-demand: `node server/scripts/weekly/weekly-pressers-ingest.js`

## Filters

- Drops non-football sports from the official athletics channel
- Keeps titles with press conference / media availability / Media Days
- Search path requires Florida/Gators/Sumrall in the title

## Optional env

- `FILM_ROOM_YOUTUBE_SOURCES=channelId:pressers:Label,channelId:gnfp:GNFP`
- `FILM_ROOM_YOUTUBE_SEARCH_QUERIES=query one|query two`
- `FILM_ROOM_YOUTUBE_SEARCH_DISABLED=true`
- `FILM_ROOM_CACHE_PATH=/path/to/cache.json`
