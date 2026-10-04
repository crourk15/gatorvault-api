# Facebook / Instagram — App Install (Oct 2026)

**Campaign:** GatorVault Insider — South Carolina Homecoming week
**Objective:** App installs (iOS) — not website traffic
**Account:** GatorVault Ads (`1072360225309877`)
**App:** GatorVault Insider — App Store `id6783848215`
**Store URL:** https://apps.apple.com/app/gatorvault-insider/id6783848215
**Facebook App ID:** `2339620876443889`

Do **not** run this as a website-traffic campaign. Destination is the App Store.

---

## What to run

The live ad **App screen — live cut** is the winner ($3.28 → $1.63 CPI). Do **not** pause or replace it.

Add these in the **same ad set** so Meta can split:

| File | Role |
|---|---|
| `creatives/fb-livecut-sc-week-15s.mp4` | **Add this.** Same live-cut language. This week. South Carolina / 12:45 SECN / Easton Royal / 4-1. No Bailey. |
| `creatives/fb-livecut-sc-week-still.jpg` | **35–54 static.** Game Week card. Meta asked for an older-demo still. |
| Current **App screen — live cut** | **Keep spending.** Missouri-week winner. After ~50 installs on the twin, pause whichever is weaker. |

Do **not** upload: `fb-ugc-sc-week-15s.mp4` (white hand). The elite poster (`fb-elite-sc-week-15s.mp4`) is a lookbook, not the install primary.

---

## Live-cut twin (what happens)

Same rhythm as the winner:

| Time | Beat |
|---|---|
| 0:00–0:04.4 | Full-bleed Home. NOW is this week. Game Week is Florida vs South Carolina, Oct 10, 12:45 ET. Caption: SOUTH CAROLINA WEEK. |
| 0:04.4–0:06.4 | Pull back — phone on night stadium, Game Week fitted on the screen |
| 0:06.4–0:10 | Full-bleed Film Room (GNFP vs Ole Miss) |
| 0:10–0:12.2 | Back to Home |
| 0:12.2–0:15 | GATOR VAULT / ONE VAULT. / Download on the App Store |

Re-render:

```bash
python3 server/brand/ads-kit/render-livecut-sc-week-ad.py
```

---

## Ads Manager copy (same as the winner)

South Carolina week is already in the app.

Countdown. The board. The tape.

One vault. Only Gators.

Headline: **The Gator week. One vault.**
CTA: **Install now**

---

## Do not

- Do not replace the $1.63 live cut.
- Do not upload the raw Home screenshot (Bailey / ABC-or-SECN).
- Do not run the white-hand UGC.
- Do not send traffic to gatorvaultinsider.com.
- Do not start Codemagic.
- Do not turn extra spend on until Charles says go. Adding the twin to the existing set is the move.
