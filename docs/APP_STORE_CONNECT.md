# App Store Connect — Field-by-Field Copy

Paste-ready values for App Store Connect. Screenshots: docs/app-store-screenshots/. Subscriptions: docs/APP_STORE_SUBSCRIPTIONS.md.

**Remaining Connect steps (Age Rating, App Privacy, Pricing):** `docs/APP_STORE_CONNECT_REMAINING.md`

## App information

| Field | Value |
|-------|--------|
| Name | GatorVault Insider |
| Subtitle (30 chars max) | UF Football Intel Hub |
| Bundle ID | com.gatorvaultinsider.app |
| Primary category | Sports |
| Secondary category | News (optional) |

### URLs

- Privacy: https://gatorvaultinsider.com/privacy/
- Terms: https://gatorvaultinsider.com/terms/
- Marketing: https://gatorvaultinsider.com/
- Support email: support@gatorvaultinsider.com

## Description

GatorVault Insider is the membership hub for Florida Gators football fans — FutureCast predictions, recruiting intel, team roster and depth, live pulse, and member community.

WHAT YOU GET
- FutureCast Lab — commit likelihood, movement intel, and competing schools
- Recruiting Hub — class overview, commits, targets, and battles
- Team Command Center — roster, depth chart, staff, and program history
- GatorNation Live — real-time pulse and insider feed
- Member community — threads, debate, and game-week talk

COMMUNITY SAFETY
Signed-in members can report inappropriate posts and block other members. Reports are reviewed by our team. See our Privacy Policy and Terms for details.

## Keywords (100 chars)

florida,gators,football,recruiting,sec,college,sports,uf,gatorvault,futurecast

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

Upload from docs/app-store-screenshots/: 01-futurecast through 06-live-feed (**1284×2778**, 6.5" Display). iPad 13" slot: docs/app-store-screenshots/ipad-13/ (**2064×2752**). Validate with `npm run verify:app-store-screenshots`.

## Checklist

- [x] Demo account provisioned
- [ ] Password in Connect only
- [x] 6 screenshots captured (`docs/app-store-screenshots/`, `npm run capture:app-store-screenshots`)
- [ ] 6 screenshots uploaded to Connect
- [ ] Description + review notes pasted
- [ ] App Privacy questionnaire
- [ ] Subscriptions (when Developer account active)