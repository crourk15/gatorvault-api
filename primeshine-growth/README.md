# PrimeShine Owner OS

Private operator page for Charles. **Not the customer website.** Do not publish this folder with `primeshine/`.

Rooms: **Today** · **30-day plan** · **Calendar** · **Book** · **Books**.

**Book desk:** save a phone call (so they do not disappear) or lock them on a day with Today / Tomorrow / +3 / +7. Calendar and Book both show the next 14 days — who is booked, what time, and the dollar amount.

**Monthly:** after they agree, Enroll monthly → put their amount (it can differ per car) → Save + open text. That text confirms the monthly price and the first visit. It also drops the next 6 months on the calendar.

Prices and the first-10 50% offer must match [primeshinefl.com/pricing](https://primeshinefl.com/pricing). After Collect, send the review text from the review screen.

## Local preview

```bash
python3 -m http.server 4174 --directory primeshine-growth
```

- http://127.0.0.1:4174/
- http://127.0.0.1:4174/?today=1

## Data (this browser only)

- Plan checks: `primeshine_30day_v2`
- Jobs: `primeshine_jobs_v1`
- Clients / expenses / leads / PIN: `primeshine_os_v1`

Download CSV or JSON from **Books** before clearing Safari.

## Deploy

Second Netlify site on `primeshine-growth/` only. Never link it from the customer site.
