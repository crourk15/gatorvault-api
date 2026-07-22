# Submit 1.0.9 (Build 44) — Schedule polish + recruiting freshness

## Schedule

Win probability % and ticket prices were clipping off the right edge on mobile (content-box width + flex rows). Cards now stay inside the frame; ticket names ellipsize; prices stay visible.

## Recruiting / FutureCast freshness

Production was waiting up to **2h** for On3 board ingest and **24h** for RPM %, with a **30m** client hub cache and no soft poll.

- New Render cron `gatorvault-api-recruiting-light` every **20m** (On3 + hub refresh)
- Hub refresh cron tightened to **every 30m**
- On3 RPM allowlist sync every **4h** (was daily)
- Client hub cache TTL **3m** + **90s** soft poll while the hub is open
- Shorter CDN TTLs on hub bundle endpoints

Heavy portal + beat-writer stay on the 2h ingest cron (Starter OOM guard).

## iOS

- `MARKETING_VERSION = 1.0.9`
- `CURRENT_PROJECT_VERSION = 44`

## Ops

1. Apply/sync Render blueprint so new crons exist (`gatorvault-api-recruiting-light`, updated schedules)
2. Deploy API + Netlify web
3. Codemagic → TestFlight **44**
