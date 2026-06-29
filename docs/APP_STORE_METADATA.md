# App Store Connect Metadata Checklist

**Field-by-field Connect copy:** `docs/APP_STORE_CONNECT.md`  
**Screenshot files:** `docs/app-store-screenshots/`

## Required URLs

- [ ] Privacy Policy: https://gatorvaultinsider.com/privacy/
- [ ] Terms of Service: https://gatorvaultinsider.com/terms/
- [ ] Marketing URL: https://gatorvaultinsider.com/
- [ ] Support email: support@gatorvaultinsider.com

## App Privacy questionnaire (high level)

- Contact info (email) — account creation
- User content — community posts (optional, member-generated)
- Identifiers — account ID / email for auth
- Purchases — subscription status (when IAP live)
- Data not used for tracking across apps

## UGC moderation disclosure (App Description / Review Notes)

Include a short statement such as:

> Member community includes tools to report inappropriate content and block other members. Reports are reviewed by our team. See our Privacy Policy and Terms for details.

Cross-links already in `client/lib/legal-content.ts` (Privacy — community data; Terms — acceptable use).

## Screenshot plan (6.7" and 6.5" displays)

| # | Screen | Route | Highlights |
|---|--------|-------|------------|
| 1 | FutureCast Lab | /vault/futurecast/ | Master board, movement, trending |
| 2 | Recruiting Hub | /vault/recruiting/ | Class overview, board |
| 3 | Team Hub | /vault/team/ | Roster, depth, coaches |
| 4 | Community | /vault/community/ | Threads, report/block (signed in) |
| 5 | Membership | /vault/membership/ | Tiers, trial, account management |
| 6 | GatorNation Live | /vault/live-feed/ | Live feed / pulse |

Capture at **1284×2778** (6.5" Display slot) via `npm run capture:app-store-screenshots`. Optional iPad 13" at **2064×2752** via `npm run generate:ipad-screenshots`.

## Privacy strings (Info.plist — when iOS shell ships)

| Key | Suggested copy |
|-----|----------------|
| NSCameraUsageDescription | Not used unless added later |
| NSPhotoLibraryUsageDescription | Not used unless avatar upload added |
| (Push) | Required when Step 5 push is enabled |

## Subscription metadata

See `docs/APP_STORE_SUBSCRIPTIONS.md` for product IDs and group setup.

## Pre-submission checklist

- [x] Demo account works on production (`scripts/provision-app-review-account.js`)
- [x] App Store Connect copy doc (`docs/APP_STORE_CONNECT.md`)
- [ ] Demo password entered in App Store Connect only
- [ ] 6 screenshots uploaded to Connect (`docs/app-store-screenshots/`)
- [x] Report + block tested on Community (Step 6 QA)
- [ ] Delete account tested on Membership (reviewer: do not delete demo account)
- [x] Privacy + Terms load without auth (`node scripts/app-store-smoke.js`)
- [ ] Subscription restore flow (Step 3b — server restore + native sync wired; live sandbox when Apple IAP enabled)
- [ ] No broken deep links on cold start (Step 8 — run `node server/scripts/verify-aasa.js` after deploy)

## Step 3b — Apple IAP (2026-06)

- [x] StoreKit verify route (`POST /api/subscription/apple/verify`) behind `APPLE_IAP_VERIFICATION_ENABLED`
- [x] Restore route (`POST /api/subscription/apple/restore`) + Membership **Restore purchases** sync
- [x] App Store Server Notifications handler (`POST /api/subscription/apple/notifications`)
- [x] Unit tests: `node --test server/tests/subscription/apple-iap-notifications.test.js`
- [x] Wiring check: `node client/scripts/verify-ios-iap-wiring.js`
- [ ] Live sandbox purchase + notification on device (paused — Apple Developer account)

## Step 8 — Universal links / AASA (2026-06)

- [x] `client/scripts/generate-aasa.js` runs in Netlify build (paths published even before `APPLE_TEAM_ID`)
- [x] Prod verify script: `node server/scripts/verify-aasa.js`
- [ ] Set `APPLE_TEAM_ID` in Netlify when Developer account is active (fills `appIDs` for live universal links)
- [ ] TestFlight cold-start deep link to `/vault/*` (paused — signing)

## Step 7 — Team Hub polish (2026-06)

- [x] Team hub loading skeletons (roster, depth, overview, pipeline, staff)
- [x] Profile spot-check script (`node server/scripts/verify-profile-spot-check.js`)
- [x] Player profile polish deployed (`26d9cda` — notes dedupe, related position buckets)
- [x] Recruiting Hub 2028: Younger Prospects panel + movement narratives on intel feed
- [x] Class targets boards: /vault/recruiting/2027/targets and /vault/recruiting/2028/targets
- [x] Team Hub pipeline follows primaryRecruitingClassYear() (2028 in discovery focus)
- [ ] TestFlight build with vault shell + deep links (paused — signing)

### Deploy verification

Run after each production push:

```bash
npm run walkthrough:app-store
npm run prep:app-store
node server/scripts/verify-profile-spot-check.js
node server/scripts/verify-recruiting-hub-spot-check.js
node server/scripts/verify-recruiting-targets-spot-check.js
node server/scripts/verify-aasa.js
npm run smoke:app-store   # requires APP_REVIEW_PASSWORD
npm run verify:app-store-screenshots
```

Confirm `build-manifest.json` commit matches latest `main` and spot-check slugs:
`jalen-brewster`, `kamauri-whitfield`, `maxwell-hiller`.
