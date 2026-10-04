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

The old **App screen — live cut** is retired. It is last week (Missouri / Bailey / ABC-or-SECN). Do not keep paying for it. Pause it.

One video. One still.

| File | Role |
|---|---|
| `creatives/fb-livecut-sc-week-15s.mp4` | **The ad.** Full-bleed Home this week → stadium phone → Film Room → App Store. |
| `creatives/fb-livecut-sc-week-still.jpg` | Optional 35–54 static if you want a cheap second format. |

Do **not** upload: `fb-ugc-sc-week-15s.mp4` (white hand). The elite poster is a lookbook, not the install primary.

Re-render:

```bash
python3 server/brand/ads-kit/render-livecut-sc-week-ad.py
```

---

## Copy

South Carolina week is already in the app.

Countdown. The board. The tape.

One vault. Only Gators.

Headline: **The Gator week. One vault.**
CTA: **Install now**

---

## Do not

- Do not keep the old live cut on. Pause it.
- Do not upload the raw Home screenshot (Bailey / ABC-or-SECN).
- Do not run the white-hand UGC.
- Do not send traffic to gatorvaultinsider.com.
- Do not start Codemagic.
