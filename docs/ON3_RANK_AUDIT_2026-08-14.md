# On3 Industry rank audit — 2026-08-14

Source of truth: **On3 Industry Consensus** (same aggregate as On3 player cards).
No Codemagic — store + hub-runtime + seed.

## UF commits
- **2026:** 22 HS commits synced; store↔snapshot mismatches = 0
- **2027:** 25 HS commits synced; store↔snapshot mismatches = 0
- **2028:** 1 HS commits synced; store↔snapshot mismatches = 0
- **Elias Pearl:** #91 natl · #17 WR · #12 FL · 93.2 composite

## 2028 chase / board targets
- Synced **133** platform players (board + allowlist + 2028 on3Id roster)
- **60** returned Industry ranks this pass
- Board coverage: **45/48** targets have natl ranks
- Still unranked on On3 (no Industry consensus yet): jordyn-murray, nikolay-petrushev, kaydan-whiteside

## Notable fills / moves this pass
- **Jermaine Cobbins:** 28→**23** natl · 4→**3** pos · 1→**1** st
- **Ryan Drakeford:** 335→**353** natl · 34→**32** pos · 11→**11** st
- **Nehemiah Mccary:** —→**34** natl · —→**2** pos · —→**2** st
- **Derrell Hines Jr:** —→**97** natl · —→**16** pos · —→**12** st
- **Gregory Kirwan:** —→**282** natl · —→**13** pos · —→**14** st
- **Tromon Isaac:** —→**92** natl · —→**14** pos · —→**11** st
- **Darryl Blackmon:** —→**384** natl · —→**58** pos · —→**12** st
- **Cale Britt:** —→**275** natl · —→**23** pos · —→**35** st
- **Ismael Schiefer:** —→**407** natl · —→**41** pos · —→**53** st
- **Madoxx Davis:** —→**26** natl · —→**6** pos · —→**3** st
- **Jerome Larue:** —→**259** natl · —→**18** pos · —→**9** st
- **Tahj Gray:** —→**27** natl · —→**1** pos · —→**2** st
- **Carter Barrett:** —→**121** natl · —→**9** pos · —→**2** st
- **Brayden Bonik:** —→**166** natl · —→**13** pos · —→**20** st
- **Andre Robinson:** —→**396** natl · —→**40** pos · —→**51** st
- **Jackson Stecher:** —→**552** natl · —→**47** pos · —→**70** st
- **Giovanni Tuggle:** —→**60** natl · —→**4** pos · —→**9** st
- **Theo Schott:** —→**234** natl · —→**9** pos · —→**2** st
- **Kingston Preyear:** —→**63** natl · —→**4** pos · —→**5** st
- **Skylar Alston:** —→**176** natl · —→**16** pos · —→**7** st
- **Nathan Holston:** —→**220** natl · —→**23** pos · —→**30** st
- **Jay Schell:** —→**129** natl · —→**9** pos · —→**16** st
- **Jayden Bell:** —→**38** natl · —→**8** pos · —→**4** st
- **J C Wessel:** —→**119** natl · —→**5** pos · —→**15** st
- **Braylen Bedford:** —→**64** natl · —→**6** pos · —→**2** st
- **Jj Chapman:** —→**553** natl · —→**48** pos · —→**20** st

## Known non-blockers
- `zyon-robinson`, `tyree-mannings-jr`: identity gate blocked write (pre-existing)
- Some early 2028 names have On3 profiles but **no Industry ranking yet** — cards correctly omit #NATL until On3 publishes consensus

## Elite full-roster follow-up (same day)
- **594** On3-linked · **525** with Industry natl · **69** confirmed On3 Industry-null (see `on3-industry-unranked.json`)
- Full-profile enrich + hs stats prefer live store over Postgres
- Stamp write-through: `refresh-stamp-ranks-from-store.js` (39 stamps updated)
