# Submit 1.0.8 (Build 37) — after Build 36 review train

Build **36** is the Film Room / hero rebundle you submitted.
Build **37** adds the next native hardenings (does not replace 36 mid-review unless Apple asks):

- Universal links / `appUrlOpen` deep links into vault paths
- Associated Domains entitlement
- IAP restore `getPurchases` fallback
- Push absolute URL → in-app path
- Community “Jump in today” + actionable rooms

## iOS

- `MARKETING_VERSION = 1.0.8`
- `CURRENT_PROJECT_VERSION = 37`

## Codemagic

1. After **36** is processing / in review (or after you decide to supersede), run **ios-release** on `main`
2. Confirm log: bundled shell, no `server.url`
3. Attach **37** to 1.0.8 only when you want this binary under review

## Also set on Netlify (for universal links)

`APPLE_TEAM_ID=45C4DZJ4UJ` (or your Team ID) so AASA publishes real `appIDs`.
