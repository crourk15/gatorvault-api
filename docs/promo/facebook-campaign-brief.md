# GatorVault — Facebook / Instagram Campaign Brief

Ready-to-run Meta Ads plan using the **Open the Vault** creatives.

---

## Goal

Drive first-time Gator fans into GatorVault via:

1. **Primary:** App installs → **Gator Vault Insider** (App Store)
2. **Secondary:** Web trial signups → 30-day free trial (no card)

Do not optimize for vanity likes. Optimize for installs + Complete Registration.

---

## Creative (ship this)

| Placement | File | Notes |
|-----------|------|--------|
| Feed / carousel square | [`PRIMARY-elite-vault-square.png`](./open-the-vault/PRIMARY-elite-vault-square.png) | 1:1 — use first |
| Stories / Reels | [`elite-vault-story.png`](./open-the-vault/elite-vault-story.png) | 9:16 |
| App Store badge (standalone) | [`download-on-app-store-black.png`](./open-the-vault/download-on-app-store-black.png) | Already baked into primary art |

**Brand rules**

- Brand on art: **GatorVault**
- App Store search / listing name: **Gator Vault Insider**
- No official UF / Florida Gators trademark logo or alligator head on ad art
- Destination domain: **gatorvaultinsider.com** (not gatorvault.com)

---

## Meta AI (restriction-safe)

Paste-ready image + copy prompts: [`meta-ai-prompt.md`](./meta-ai-prompt.md)

Prior agent rule set (avoid rejection / legal trouble):

- No UF alligator head / seal / helmet marks on art
- Never use the word "priceless"
- GatorVault is the hero (not Apple, not UF)
- Official App Store badge only; caption carries App Store link `id6783848215`

---

## Ad copy (paste into Ads Manager)

### Primary — App install / feed

**Primary text**

```
Open the Vault.

Everything Florida football — FutureCast, Recruiting, Team, Live, Game Week — in one place.

No rumors. No noise. Just truth.

Download Gator Vault Insider on the App Store:
https://apps.apple.com/us/app/gatorvault-insider/id6783848215
```

**Headline:** Open the Vault.

**Description:** Florida football intel. One app.

**CTA button:** Download / Install Now

### Alt A — Intelligence angle

**Primary text**

```
Florida Football, Unlocked.

GatorVault is the Florida football intelligence platform.

Real recruiting movement. Real film. Real NIL insights.

Join today — 30-day free trial.
```

**Headline:** Florida Football, Unlocked.

**Description:** Recruiting · FutureCast · Film Room

**CTA button:** Learn More (web) or Download (app)

### Alt B — Short Stories

**Primary text**

```
Gator Nation — it's here.

FutureCast. Recruiting. Team. Live. Game Week.

Open the Vault → Gator Vault Insider
https://apps.apple.com/us/app/gatorvault-insider/id6783848215
```

**Headline:** Open the Vault.

---

## Destination URLs

### App campaign (preferred with square/story creatives)

- App Store product page for **Gator Vault Insider** (`com.gatorvaultinsider.app`)
- Paste the live `https://apps.apple.com/app/id…` URL once Connect is live
- Until then, web fallback below still works

### Web trial campaign

| Use | URL |
|-----|-----|
| Welcome / pitch | `https://gatorvaultinsider.com/welcome/?utm_source=facebook&utm_medium=paid&utm_campaign=open_the_vault&utm_content=feed_square` |
| Direct join | `https://gatorvaultinsider.com/join/?utm_source=facebook&utm_medium=paid&utm_campaign=open_the_vault&utm_content=join_cta` |
| Film Room tier deep-link | `https://gatorvaultinsider.com/join/?tier=film&utm_source=facebook&utm_medium=paid&utm_campaign=open_the_vault&utm_content=film_room` |

Stories variant: change `utm_content=story_vertical`.

---

## Campaign structure (Ads Manager)

### Campaign 1 — App installs (iOS)

| Field | Value |
|-------|--------|
| Objective | App promotion |
| App | Gator Vault Insider (iOS) |
| Optimization | App installs (or App events → Complete Registration once SDK/events live) |
| Budget | Test: $15–25/day for 5–7 days |
| Placements | Advantage+ or manual: FB Feed, IG Feed, IG Stories, Reels |
| Creatives | Square + Story |

### Campaign 2 — Web trial (traffic → signup)

| Field | Value |
|-------|--------|
| Objective | Sales / Conversions (or Traffic if Pixel not ready) |
| Optimization | Landing page views → Complete Registration when Pixel live |
| Destination | Welcome URL above |
| Budget | Test: $10–20/day for 5–7 days |
| Creatives | Same Open the Vault art; CTA Learn More |

Run both only if App Store listing is live. If app is still in review, run **Campaign 2 only**.

---

## Audience

### Core (start here)

- Locations: United States — Florida (expand to Georgia / Alabama after creative proves CTR)
- Age: 21–54
- Gender: All
- Interests / behaviors (stack lightly, not all at once):
  - Florida Gators
  - College football
  - SEC / NCAA football
  - Recruiting / On3 / 247Sports (if available)
  - NFL / sports apps (broad)

### Exclude

- Existing customers (custom audience from email list / Pixel when available)
- Under 18

### Phase 2 (after 50+ installs or 25+ signups)

- 1% lookalike of installers / purchasers
- Retarget site visitors 7 days who did not join

---

## Offer & funnel

| Step | What happens |
|------|----------------|
| 1 | See Open the Vault ad |
| 2a | App install → create account → 30-day trial |
| 2b | Web → `/welcome/` → Join → 30-day trial (no card) |
| 3 | Onboarding drip (Day 0/1/3/7) → Film Room / FutureCast value |
| 4 | Paid convert: Apple IAP in app, or Stripe on web |

Public tiers to mention if pricing is needed:

- Locker Room — $4.99/mo
- Film Room — $9.99/mo (featured)
- 30-day free trial — no card required on web signup

Default: **do not lead with price** in the first ad. Lead with Open the Vault.

---

## Tracking checklist (before spend)

- [ ] Meta Business Manager + ad account ready
- [ ] Facebook Page + Instagram account linked
- [ ] App Store listing live + Ads Manager app connected
- [ ] Meta Pixel on `gatorvaultinsider.com` (PageView + CompleteRegistration on `/join/` success)
- [ ] UTM links above used on every ad
- [ ] Domain verified in Meta Business Manager
- [ ] iOS 14+ Aggregated Event Measurement configured if optimizing for web conversions

**Current gap in product:** no Meta Pixel / `fbq` in the web app yet. Until Pixel is live, prefer App installs objective or Traffic → Welcome, and measure signups in Admin Hub Recent Members.

---

## Compliance

- Do not use official UF logos, wordmarks, or alligator marks on creatives
- Do not imply official university affiliation
- Subscriptions: disclose auto-renew only if the ad copy mentions paid price (App Store / Meta policies)
- Prefer “Florida football” / “Gator Nation” fan language over trademarked logos

---

## Success criteria (first 7 days)

| Metric | Healthy early signal |
|--------|----------------------|
| CTR (link) | ≥ 1.0% feed / ≥ 0.7% stories |
| CPC | Watch; kill creatives >2× winners |
| Cost per app install | Benchmark after day 3 |
| Cost per web signup | Benchmark after day 3 |
| Creative winner | Keep top CTR; pause bottom half |

Kill rules: pause any ad set with spend > $40 and zero installs/signups.

---

## Assets index

```
docs/promo/open-the-vault/
  PRIMARY-elite-vault-square.png   ← feed
  elite-vault-story.png            ← stories
  download-on-app-store-black.png
  README.txt
docs/promo/meta-ai-prompt.md       ← Meta AI paste prompts
docs/META_APP_INSTALL_ADS.md       ← iOS SDK / App promotion setup

client/public/brand/ads-kit/
  facebook-instagram-ad.md         ← short paste copy
```

Contact: brand@gatorvault.com · support@gatorvaultinsider.com
