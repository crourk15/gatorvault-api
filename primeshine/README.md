# PrimeShine Mobile Detailing — customer site

Standalone public marketing site. This folder is **not** part of the GatorVault Netlify publish (`server/`). Deploy it as its own Netlify site.

The owner 30-day growth plan is a **separate site** in `primeshine-growth/`. It is not linked from this customer site and must not be published with it.

## Pages

| Path | Purpose |
|------|---------|
| `/` (`index.html`) | Public landing — services, booking, FAQ |

## Local preview

```bash
python3 -m http.server 4173 --directory primeshine
```

- Landing: http://127.0.0.1:4173/

## Business details

Edit `app.js` → `BUSINESS` and `site-config.js` for shared phone/site URLs.

- Phone: **863-860-9238**
- Booking: https://primeshinefl.com/booking
- Areas: Bartow · Lakeland · Winter Haven, FL

## Deploy

Point a new Netlify site at this folder (`primeshine/`), not the repo root, and not `primeshine-growth/`.
