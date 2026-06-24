# App Store Screenshot Capture

**Connect paste sheet:** `APP_STORE_CONNECT_PASTE.txt` (all metadata blocks)

**Automated capture** (iPhone 14 Plus → 1284×2778, App Store 6.5" slot):

```bash
APP_REVIEW_PASSWORD=... npm run capture:app-store-screenshots
```

| File | URL |
|------|-----|
| 01-futurecast.png | /vault/futurecast/ |
| 02-recruiting.png | /vault/recruiting/ |
| 03-team.png | /vault/team/ |
| 04-community.png | /vault/community/ |
| 05-membership.png | /vault/membership/ |
| 06-live-feed.png | /vault/live-feed/ |

Smoke: `APP_REVIEW_PASSWORD=... node scripts/app-store-smoke.js`