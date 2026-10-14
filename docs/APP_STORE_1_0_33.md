# Submit 1.0.33 (Build 102+) — live recruiting class chart

**Why:** **1.0.32** is already built. Do not upload another 1.0.32. This train is the next bake.

The four recruiting hero boxes have to follow the live class. Rank, blue chip, commit count, and average move when the class moves. They are not a number painted into the app.

Do **not** start Codemagic until this bump is on `main`.

## iOS

- `MARKETING_VERSION = 1.0.33`
- `CURRENT_PROJECT_VERSION = 102` (Codemagic may auto-bump above ASC latest)

## App Store Connect (you)

1. **Apps → GatorVault Insider → + Version → 1.0.33** (if Connect does not auto-create it)
2. Merge this bump to `main`
3. Start Codemagic **iOS Release Build** on `main`
4. Confirm the commit line is this 1.0.33 bump, not leftover 1.0.32
5. Attach the processed build to **1.0.33** / TestFlight

I will not start Codemagic.

## Ships in this bake

- Recruiting hero: when the live class chart arrives, the four boxes take it. Leave and come back and they stay on that line. The next commit moves them again from the API. Approved 1.0.31 still paints class rank #8, 26 commits, average 89.9 and leaves them there.

## Whats New (paste)

```
The 2027 recruiting class chart stays on the live class. A new commit moves the rank, the count, and the average.
```

## Already live (no extra bake)

The class line the app downloads is computed from the class (rank, blue chip, commits, average). It is not locked to one plate. Easton Royal stays first on the 2027 commit list.
