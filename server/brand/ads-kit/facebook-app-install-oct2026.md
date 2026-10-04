# Facebook / Instagram — App Install video (Oct 2026)

**Campaign:** GatorVault Insider — South Carolina Homecoming week
**Objective:** App installs (iOS) — not website traffic
**Account:** GatorVault Ads (`1072360225309877`)
**App:** GatorVault Insider — App Store `id6783848215`
**Store URL:** https://apps.apple.com/app/gatorvault-insider/id6783848215
**Facebook App ID:** `2339620876443889`

Do **not** run this as a website-traffic campaign. Destination is the App Store.

Lead with **video**. The three-phone stills in `#795` are a lookbook, not the install ad.

---

## Primary creative (upload this first)

| File | Size | Placement |
|---|---|---|
| `creatives/fb-ugc-sc-week-15s.mp4` | 9:16 · 15s · 1080×1920 · H.264 · 24fps · ~1.3MB | Reels, Stories, in-stream, Advantage+ |

### What happens

| Time | Beat |
|---|---|
| 0:00–0:05 | Hand holds the phone on **Game Week** — Florida vs South Carolina, Oct 10, 12:45 ET, Ben Hill Griffin, countdown |
| 0:05–0:05.5 | Swipe left to FutureCast Lab |
| 0:05.5–0:09.2 | **Izayah Vickers** / commit-likelihood gauge |
| 0:09.2–0:09.7 | Swipe left to Film Room |
| 0:09.7–0:12.2 | GNFP Florida vs Ole Miss 2026 review — tap on the play button |
| 0:12.2–0:15 | End card: **GATORVAULT / INSIDER / GET THE APP** |

On-screen caption: **South Carolina week is already in the app.**

Screens are the real iOS pixels, chroma-keyed onto a generated hand plate (`render-ugc-sc-week-ad.py`). Home is cropped to Game Week so leftover NOW News (Samuel Bailey / ABC-or-SECN) never appears.

Re-render:

```bash
python3 server/brand/ads-kit/render-ugc-sc-week-ad.py
```

---

## Still backup (one phone, not a lookbook)

| File | Size | Placement |
|---|---|---|
| `creatives/fb-ugc-gameweek-still.jpg` | 9:16 · 1080×1920 | Stories / Reels still if the video is rejected, or a static companion |

Same Game Week crop. Do **not** upload the raw Home screenshot.

Cinematic three-phone stills and carousel cards live on `cursor/fb-ad-screens-702d` (PR #795) if you want a second static flight after the video is spending.

---

## Ads Manager copy

### Primary text — short (Reels / Stories)

South Carolina week is already in the app.

Countdown. The board. The tape.

One vault. Only Gators.

### Primary text — medium (default)

Florida vs South Carolina is already on the home screen.

Oct 10. 12:45 ET. SEC Network.

Swipe and the board is a machine. Tap and it is GNFP tape.

If you live this program, this is the app.

### Primary text — long (Advantage+)

Gator fans do not need another rumor account.

You need the week: who we play, who we are chasing, what the tape said.

That is GatorVault Insider.

This week's home screen is South Carolina in the Swamp — Oct 10, 12:45 ET, Ben Hill Griffin — with the countdown sitting on Game Week.

Open FutureCast and the 2028 board is a machine. Izayah Vickers is on the Lab.

Open Film Room and it is GNFP — Florida vs Ole Miss, 2026 review.

One login. One vault. iPhone.

### Headline (40 characters or less)

The Gator week. One vault.

Alts to A/B:

- South Carolina week. Unlocked.
- Board. Tape. Kickoff. One app.
- Only Gators get out alive.

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

**Detailed targeting (OR, keep it loose so Advantage+ can work):**

- Interests: Florida Gators, college football, SEC, On3, 247Sports, recruiting
- Behaviors: engaged sports fans, American football
- Lookalike: GatorVault purchasers / app openers once Meta has 1k+ events

**Exclude:** existing app users (once AEM is healthy)

**Placements:** Advantage+ with Stories + Reels on. Do not force Audience Network only.

**Budget:** one ABO ad set on the **video** first. Do not split feed vs stories until you have 50 installs.

---

## Optimization

- Event: **App install** (iOS)
- Attribution: 1-day click / 1-day view is fine for a new install campaign
- AEM: already wired in the App Store binary (`FBSDKCoreKit`). If Ads Manager still says AEM missing, open the app on a TestFlight/store build once after install.

---

## Do not

- Do not upload the raw Home screenshot — it still has leftover NOW News (Samuel Bailey / ABC or SEC Network). The Game Week crop is the one in these files.
- Do not lead the flight with the three-phone cinematic stills. Those are a lookbook.
- Do not write "rotational QB," fake commits, or a Florida-alum default comp in the copy.
- Do not send this traffic to gatorvaultinsider.com. App Store only.
- Do not start a new Codemagic bake for the ad.
- Do not turn spend on until Charles says go.

---

## Voice check

Swamp at night. Insider, not hype-house.
Short sentences. Named product surfaces. Named this-week game.
No "unlock your potential." No stock crowd roar.
