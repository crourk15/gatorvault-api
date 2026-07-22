# Submit 1.0.8 (Build 39) — living Community + native cold start

Build **38** covered Community daily-loop UI, pending IAP stash, Home strip.
Build **39** makes Community durable/alive and hardens native cold start:

## Community (living product)

- Durable UGC on `/var/data/community` (`GV_COMMUNITY_DATA_DIR`) — survives Render redeploys
- Daily staff open thread (ET) via cron + `ensureDailyOpenThread` (real OP, replyCount 0)
- Admin staff compose + staff reply in Community Admin
- Honest pulse (threads with replies only)
- Home/deep links use `/vault/community/thread/:id`

## Native feel

- Splash owned by app (`launchAutoHide: false`) — hide after first paint
- Boot script: early `gv-native-app`, skip Preferences wait when session already in localStorage
- Soft-nav for programmatic vault hrefs when shell router is mounted
- Resume: clear stuck navigating + warm API
- Bundled shell: single click interceptor (boot script)

## iOS

- `MARKETING_VERSION = 1.0.8`
- `CURRENT_PROJECT_VERSION = 39`

## After merge

1. Confirm Render picks up `GV_COMMUNITY_DATA_DIR` + community-daily-open cron
2. Codemagic → TestFlight **39**
3. Device check: cold launch (no blank flash), Community Jump in today = daily OP, staff reply via admin
