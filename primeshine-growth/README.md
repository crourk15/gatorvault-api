# PrimeShine owner growth plan

Private 30-day checklist for Charles. **Separate from the customer website.** Do not publish this folder with `primeshine/` (the public landing).

Customers book at [primeshinefl.com](https://primeshinefl.com). This page is bookmark-only.

## Local preview

```bash
python3 -m http.server 4174 --directory primeshine-growth
```

- http://127.0.0.1:4174/
- http://127.0.0.1:4174/?today=1  (opens today’s tasks)

## How Charles opens it

1. Bookmark the owner URL (add `?today=1`).
2. Tap **Open today** if the checklist is not already open.
3. Check off tasks. Progress stays in this browser (`localStorage` key `primeshine_30day_v2`).
4. **Job calendar** on the same page tracks new clients and monthly maintenance (`primeshine_jobs_v1`).

## Deploy

Point a **second** Netlify site at `primeshine-growth/` (or keep it local/bookmark-only). Do not add this URL to the customer site menu or footer.
