# App Store Connect — Field-by-Field Copy

Paste-ready values for App Store Connect. Screenshots: docs/app-store-screenshots/. Subscriptions: docs/APP_STORE_SUBSCRIPTIONS.md.

**Remaining Connect steps (Age Rating, App Privacy, Pricing):** `docs/APP_STORE_CONNECT_REMAINING.md`

## App information

| Field | Value |
|-------|--------|
| Name | GatorVault Insider |
| Subtitle (30 chars max) | Commits, portal & visit alerts |
| Bundle ID | com.gatorvaultinsider.app |
| Primary category | Sports |
| Secondary category | News (optional) |

Do **not** rename the app. Do **not** change IAP prices or the 30-day no-card trial.

### Promotional text (170 chars max — editable without a new build)

Florida recruiting in one place: 2028 board, campus visits, Game Week keys, and film. 30-day free trial — no card required.

### URLs

- Privacy: https://gatorvaultinsider.com/privacy/
- Terms: https://gatorvaultinsider.com/terms/
- Marketing: https://gatorvaultinsider.com/
- Support email: support@gatorvaultinsider.com

## Description

Every Florida recruiting storyline, in one place.

You already follow the class. You know the board, the visits, and which recruit everyone is talking about. GatorVault puts all of it together so you are not jumping between message boards, timelines, and five different tabs.

Built by Gator fans, for Gator fans. Florida only — no national noise.

WHAT'S INSIDE
- Recruiting board — 2027 commits and 2028 targets, with status and movement
- Visits — official and unofficial campus visits, plus alerts
- Portal tracker — incoming transfers on the Florida roster
- Game Week — keys, matchup edge, and who is on campus
- Team hub — roster, depth chart, and staff
- Live feed and member community

FUTURECAST
Florida lean and week-to-week movement on the targets that matter. Full FutureCast unlocks with a Film Room plan.

FILM ROOM
Game film, breakdowns, and scouting reports on the players and opponents that matter.

PLANS
Start with a 30-day free trial — no card required. Then choose:
- Locker Room — $4.99/month or $47.88/year
- Film Room — $9.99/month or $95.88/year
- War Room — $19.99/month or $191.88/year

Payment is charged to your Apple Account at confirmation of purchase. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store account settings.

COMMUNITY SAFETY
Signed-in members can report inappropriate posts and block other members. Reports are reviewed by our team.

LEGAL
Privacy Policy: https://gatorvaultinsider.com/privacy/
Terms of Use (EULA): https://gatorvaultinsider.com/terms/

GatorVault is an independent fan app and is not affiliated with or endorsed by the University of Florida.

## Keywords (100 chars)

football,uf,florida,gators,recruiting,signing,2028,class,predictions,sec,depth,chart,film,futurecast

Skip words already in the name (GatorVault Insider) or subtitle (commits, portal, visit, alerts). Do not add competitor names.

## App Review Information

- Sign-in required: Yes
- Demo username: appreview@gatorvaultinsider.com
- Demo password: App Store Connect secure field only
- Contact: support@gatorvaultinsider.com

### Notes for reviewer (paste into Connect)

GatorVault Insider — demo account has War Room tier (full access until StoreKit live).

SIGN IN: https://gatorvaultinsider.com/join/

REVIEW PATHS
1. FutureCast — /vault/futurecast/
2. Recruiting — /vault/recruiting/
3. Team — /vault/team/
4. Community — /vault/community/ → thread → Report / Block user
5. Membership — /vault/membership/ (do NOT delete demo account; delete UI at #delete-account)
6. Legal — /privacy/ and /terms/ (no sign-in)

UGC moderation: report + block. Account deletion: password + type DELETE.
Support: support@gatorvaultinsider.com

## Screenshots

File names stay `01-futurecast` through `06-live-feed` (**1284×2778**, 6.5" Display). Upload **recruiting first**, then FutureCast — those two are what most searchers see. iPad 13" slot: docs/app-store-screenshots/ipad-13/ (**2064×2752**). Validate with `npm run verify:app-store-screenshots`.

| Upload order | File | Caption |
|---|---|---|
| 1 | `02-recruiting.png` | Every Florida target. One board. |
| 2 | `01-futurecast.png` | See who's leaning Florida, and how the board moves |
| 3 | `03-team.png` | Roster, depth, and staff in one hub |
| 4 | `06-live-feed.png` | Today's Florida recruiting feed |
| 5 | `04-community.png` | Talk the class with other fans |
| 6 | `05-membership.png` | 30-day free trial. No card required. |

Use real, current screens. Do not lead with a logo or the paywall.

## What's New template

Lead with what fans get, not what you fixed. Paste on the new version:

```
NEW: [one feature, in fan terms]

IMPROVED: [one change they'll notice]

Plus bug fixes. Go Gators.
```

## Checklist

- [x] Demo account provisioned
- [ ] Password in Connect only
- [x] 6 screenshots captured (`docs/app-store-screenshots/`, `npm run capture:app-store-screenshots`)
- [ ] 6 screenshots uploaded to Connect
- [ ] Description + review notes pasted
- [ ] App Privacy questionnaire
- [ ] Subscriptions (when Developer account active)