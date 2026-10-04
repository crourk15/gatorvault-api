# Facebook / Instagram — App Install (Oct 2026)

**Campaign:** GatorVault Insider — South Carolina homecoming week
**Objective:** App installs (iOS). Not website traffic.
**Account:** GatorVault Ads (1173230622539087)
**App:** GatorVault Insider — App Store id6783848215
**Store URL:** https://apps.apple.com/app/gatorvault-insider/id6783848215
**Facebook app ID:** 2369207876438489

Do not run this as a website-traffic campaign. Destination is the App Store.

---

## What to run

Keep the live ad **App screen — live cut**. Do not remake it. Do not send it back through Runway.

This file is that same 15s 9:16 cut with **only the homepage** swapped to this week.

| File | Role |
|---|---|
| `creatives/fb-tight-home-sc-15s.mp4` | **The ad.** Same phone, stadium, FutureCast, end card, audio. Home is South Carolina week. |
| `creatives/fb-tight-home-sc-still.jpg` | Optional 9:16 static if you want a cheap second format. |

Upload `fb-tight-home-sc-15s.mp4` into the same App Install ad. Replace the creative. Do not pause the winner and start a new ad.

Do not upload `fb-ugc-sc-week-15s.mp4` (white hand). The elite poster is a lookbook, not the install primary.

Rebuild:

```bash
python3 server/brand/ads-kit/patch-tight-home-sc.py
```

Source cut (the one that is already converting): `source/gatorvault-ad-tight-15s.mp4`

---

## Copy

South Carolina week is already in the app.

Countdown. The board. The tap.

One vault. Only Gators.

Headline: **The Gator week. One vault.**
CTA: **Install now**

---

## Home on the glass (this week)

- GAME — South Carolina · 12:45 PM · SECN
- VISITORS — Easton Royal
- SEASON — 4-1 · SEC home Saturday
- Game Week card — Florida vs South Carolina, Oct 10, 12:45 ET, Ben Hill Griffin

Bailey stays off. Missouri stays off. ABC-or-SECN stays off.

---

## Do not

- Do not remake the 3D phone / stadium / FutureCast / end card
- Do not run Runway on this cut
- Do not upload the raw Home screenshot
- Do not run the white-hand UGC
- Do not send traffic to gatorvaultinsider.com
- Do not start Codemagic
- Do not turn Ads Manager spend on until Charles says go
