# App Store 1.0.4 — Build 15

**Status:** Hold until **1.0.3 / Build 14** clears App Review (Waiting for Review as of Jul 15, 2026).

**Why:** Ship the native player-profile tap fix, in-vault Articles reader, Team Pipeline Map mobile layout, and Film Room YouTube Error 153 fix. Bundle after 14 so we do not interrupt the speed update already in review.

**Version:** marketing `1.0.4` · build `15`  
**Bundle:** `com.gatorvaultinsider.app`

## Include in this binary

1. **Player profile taps (iOS)** — vault/player links soft-nav in the Capacitor shell (hard-nav to missing `{slug}/index.html` was a no-op). Files: `client/lib/native-boot-script.ts`, `client/lib/native-app-entry.ts`, `client/lib/player-slug-from-path.ts`.
2. **Articles** — in-vault reader + gating already in repo; confirm latest `client/components/articles/*` and article routes are on `main` before Codemagic. Publish Charles-approved drafts via GV-OM so content is live on API (content does not require the binary, but the reader UI does).
3. **Team Pipeline Map (mobile)** — horizontal state bars instead of squeezed column chart. Already on `main` (`ca9fe0b`). Files: `client/components/team/premium/PipelineMap.tsx`, `client/lib/team-premium.css`. **Requires this binary** — does not OTA into the App Store shell.
4. **Film Room YouTube Error 153** — site-hosted embed relay + catalog `embedUrl` (`2dac918`). Relay HTML/API help via Netlify/Render; client iframe wiring still ships in this binary for full native polish. Files: `client/public/youtube-embed.html`, `client/components/vault/VaultFilmRoomPage.tsx`, `server/lib/film-room-feed.js`.
5. **Game Week energy + Thursday cadence** — implemented on `main` (Jul 16):
   - Visual: Gator orange / blue / white throughout (`client/lib/game-week-wow.css`).
   - Product copy: **Thursday briefing** ritual; depth tab explains Wed+ official depth lock (`GameWeekCommandCenter.tsx`, `game-week-data.ts`).
   - Still ops: refresh intel content each Thursday in-season (not auto from UF site yet).
6. **Gators Live** (was Live Scores) — Florida-only game-day scoreboard shell:
   - Renamed in nav/UI; route stays `/vault/live-scores/`.
   - Offseason: ready card + next UF game; **no provider API polls** until UF live window (~3h pre → ~5h post kickoff).
   - Files: `client/components/vault/VaultLiveScoresPage.tsx`, `client/lib/gators-live.ts`.
   - Season work still owed: wire real UF score/clock (not just betting schedule) before Sep kickoff.
7. Anything else approved for 15 before Codemagic starts.

## What's New (paste into App Store Connect)

Player profiles open correctly when you tap a name in Recruiting, Team, and FutureCast. In-vault Articles reader. Team Recruiting Pipeline map readable on iPhone and iPad. Film Room videos open without the Error 153 splash. Game Week gets louder Gator colors and a Thursday briefing cadence. Gators Live — Florida game-day scoreboard, ready for the season. Builds on the faster Vault loading from 1.0.3.

## Build path (after 14 is live)

1. Confirm items 1–6 above are on `main`
2. Approve/publish any article drafts Charles wants live
3. Codemagic → **iOS Release Build** (`ios-release`) on `main`
4. App Store Connect → version **1.0.4** → build **15** → Submit for Review
5. Smoke on device: player tap, Articles, Team → Pipeline Map, Film Room (no Error 153), Game Week, Gators Live ready card

## Do not

- Remove 1.0.3 from review for this
- Fold auth / IAP / demo-account changes into 15 without explicit confirmation
