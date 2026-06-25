#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const review = `# App Store Review Notes (GatorVault Insider)

Use this text in **App Review Information -> Notes** and adapt for each submission.

## App summary

GatorVault Insider is a subscription-based Florida Gators football coverage app (recruiting, FutureCast, team hub, film room, schedules, NIL, and member community). Web and iOS share the same authenticated experience.

## Test account

Provide a demo account in App Review Information with Film Room or War Room tier for full feature access.

## User-generated content (UGC) moderation

Community is members-only. Signed-in users can report thread OP and replies, and block other members. Reports use POST /api/community/post/:id/flag and POST /api/community/thread/:id/flag. Review path: Vault -> Menu -> Community -> open a thread -> Report / Block user.

## Account deletion

Vault -> Membership & Account -> Delete account (/vault/membership/#delete-account). Requires password and typing DELETE.

## Legal links

Privacy Policy: https://gatorvaultinsider.com/privacy/
Terms of Service: https://gatorvaultinsider.com/terms/

## Subscriptions

See docs/APP_STORE_SUBSCRIPTIONS.md. IAP via StoreKit is Step 3b (pending Apple Developer account).
`;
fs.writeFileSync(path.join(__dirname, "..", "docs", "APP_STORE_REVIEW.md"), review, "utf8");
