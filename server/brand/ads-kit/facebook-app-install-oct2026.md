# Facebook / Instagram — App Install video (Oct 2026)

**Campaign:** GatorVault Insider — South Carolina Homecoming week
**Objective:** App installs (iOS) — not website traffic
**Account:** GatorVault Ads (`1072360225309877`)
**App:** GatorVault Insider — App Store `id6783848215`
**Store URL:** https://apps.apple.com/app/gatorvault-insider/id6783848215
**Facebook App ID:** `2339620876443889`

Do **not** run this as a website-traffic campaign. Destination is the App Store.

Lead with the **elite video**. Do not run the hand-held UGC (`fb-ugc-sc-week-15s.mp4`). That version looks stuck-on.

---

## Primary creative (upload this first)

| File | Size | Placement |
|---|---|---|
| `creatives/fb-elite-sc-week-15s.mp4` | 9:16 · 15s · 1080×1920 · H.264 · 24fps | Reels, Stories, Advantage+ |

### What happens

| Time | Beat |
|---|---|
| 0:00–0:05 | Swamp-navy poster. **SOUTH CAROLINA**. Real Game Week card (Florida vs South Carolina, Oct 10, 12:45 ET, countdown) as a flat fitted rectangle. **Already in the app.** |
| 0:05–0:05.5 | Fade to FutureCast Lab |
| 0:05.5–0:09.2 | Full-bleed **Izayah Vickers** / commit-likelihood gauge |
| 0:09.2–0:09.6 | Fade to Film Room |
| 0:09.6–0:12.2 | Full-bleed GNFP Florida vs Ole Miss — tap the play button |
| 0:12.2–0:15 | End card: **GATORVAULT / INSIDER / GET THE APP** |

No hand. No living-room plate. No 3D phone warp. Home is cropped so leftover NOW News (Samuel Bailey / ABC-or-SECN) never appears.

Re-render:

```bash
python3 server/brand/ads-kit/render-elite-sc-week-ad.py
```

---

## Still backup

| File | Size | Placement |
|---|---|---|
| `creatives/fb-elite-gameweek-still.jpg` | 9:16 · 1080×1920 | Stories / Reels still if the video is rejected, or a static companion |

Same Game Week poster. Do **not** upload the raw Home screenshot.

---

## Do not run

| File | Why |
|---|---|
| `fb-ugc-sc-week-15s.mp4` | White living-room hand. Screenshot warped onto a fake phone. Looks stuck-on. |
| `fb-ugc-gameweek-still.jpg` | Same plate. |
| Raw Home screenshot | Leftover NOW News (Samuel Bailey / ABC or SEC Network). |

Three-phone cinematic stills on `cursor/fb-ad-screens-702d` (PR #795) stay a lookbook, not this flight.

---

## Ads Manager copy

### Primary text — short (Reels / Stories)

South Carolina week is already in the app.

Countdown. The board. The tape.

One vault. Only Gators.

### Primary text — medium (default)

Florida vs South Carolina is already on the home screen.

Oct 10. 12:45 ET. SEC Network.

The board is a machine. The tape is GNFP.

If you live this program, this is the app.

### Headline (40 characters or less)

The Gator week. One vault.

Alts:

- South Carolina week. Unlocked.
- Board. Tape. Kickoff. One app.

### Description (optional, 30 characters)

Florida football, unlocked.

### CTA button

**Install now**

Do not use Learn more or Shop now.

---

## Targeting (first 7 days)

**Geo:** Florida first. Then Georgia / Alabama / South Carolina for the week.
**Age:** 21–64
**Gender:** all

**Placements:** Advantage+ with Stories + Reels on.
**Budget:** one ABO ad set on the **elite video** first.

---

## Optimization

- Event: **App install** (iOS)
- Attribution: 1-day click / 1-day view
- AEM: already in the App Store binary (`FBSDKCoreKit`)

---

## Do not

- Do not upload the raw Home screenshot.
- Do not run the white-hand UGC.
- Do not send traffic to gatorvaultinsider.com. App Store only.
- Do not start Codemagic for the ad.
- Do not turn spend on until Charles says go.

---

## Voice check

Swamp at night. Insider, not hype-house.
Short sentences. Named product surfaces. Named this-week game.
