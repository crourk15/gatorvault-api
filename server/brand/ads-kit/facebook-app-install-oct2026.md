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

Charles's elite 10s 9:16 cut with only the end-card pill rewritten. The rest of the video is untouched.

The uploaded export had a real Apple mark and then AI garbage (`Capplnonh Pipp` / `DOWNLOAD NOWW`). That text is now the official App Store line. Apple logo and outline stay.

| File | Role |
|---|---|
| `creatives/fb-elite-appstore-10s.mp4` | **The ad.** 10s, 1080x1920, H.264 + original AAC. Replace the live Facebook creative with this. |
| `creatives/fb-elite-appstore-still.jpg` | Optional 9:16 static of the fixed end card. |

Upload `fb-elite-appstore-10s.mp4` into the same App Install ad. Replace the creative. Do not pause the winner and start a new ad.

Rebuild:

```bash
python3 server/brand/ads-kit/patch-elite-endcard.py
```

Source cut: `source/gatorvault-ad-elite-export.mp4` (Charles Oct 5 export)

Phone chrome (time, battery, record dot, fantasy Live Activity) is cropped off the top. Rebuild that too:

```bash
python3 server/brand/ads-kit/patch-elite-hide-chrome.py
```

Previous 15s home-patch cut stays on disk as `creatives/fb-tight-home-sc-15s.mp4`. Do not upload that one if this 10s cut is the replace.

---

## Copy

South Carolina week is already in the app.

Countdown. The board. The tap.

One vault. Only Gators.

Headline: **The Gator week. One vault.**
CTA: **Install now**

End-card badge (on tape): **Download on the / App Store**

---

## Do not

- Do not remake the rest of this 10s cut
- Do not run Runway on this cut
- Do not run the white-hand UGC
- Do not send traffic to gatorvaultinsider.com
- Do not start Codemagic
- Do not turn Ads Manager spend on until Charles says go
