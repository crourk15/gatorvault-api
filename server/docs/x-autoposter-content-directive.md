# GatorVault AutoPoster — Final Content + Behavior Directive

**Account:** @gatorvault  
**Auth:** OAuth 1.0a for all posting · Bearer read-only for beat stream (`live-beat.js`)

---

## Mission

Build a posting engine that:

- Feels like a real Gator insider account
- Provides value to fans
- Grows the GatorVault brand organically
- Drives traffic without sacrificing trust

---

## Dual mandate

The AutoPoster must do **both** of the following:

### 1. Credible, sourced Gator news + real-time engagement

- Post Florida Gators news, updates, and summaries from **credible sources**
- Engage with Gator Nation (quote tweets, replies, hype posts, reactions)
- Cover recruiting, portal moves, staff updates, game week notes, etc.
- **No AI-invented news** — everything factual must be sourced
- **Tone:** fan-first, authoritative, trustworthy

### 2. Promote GatorVault naturally within the content flow

- Advertise GatorVault platform, features, dashboards, and updates
- Drive traffic to [gatorvaultinsider.com](https://gatorvaultinsider.com) without spamming
- Blend promotion into the news cycle: **value → engagement → promotion**

---

## Content mix (50 / 30 / 20)

| Category | Target | Purpose |
|----------|--------|---------|
| **news** | 50% | Sourced Gator updates (recruiting, portal, staff, game week) |
| **engagement** | 30% | Replies, quote tweets, hype, reactions with Gator Nation |
| **promo** | 20% | GatorVault features, dashboards, trial, site traffic |

Growth strategy: **value first, engagement second, promotion third.**

The scheduler tracks sent posts and reports mix drift via `GET /api/x/autoposter/mix`.

---

## Category rules (enforced in code)

### News (`category: "news"`)

- **Requires** `sources[]` — at least one trusted outlet or public URL
- Approved: On3, 247Sports, Rivals Florida, OnlyGators, Gators Online, beat writers, FloridaGators.com
- Blocks AI-invented / unsourced rumor language

### Engagement (`category: "engagement"`)

- **Actions:** `post` (hype), `reply`, `quote`
- Replies require `inReplyToStatusId`
- Quote tweets require `quoteTweetUrl` or `quoteTweetId`
- Pure hype/reactions may omit sources; **any factual claim still requires sources**

### Promo (`category: "promo"`)

- Must mention GatorVault or link to gatorvaultinsider.com
- No fake news — promote real features and live dashboards
- Blend into cycle; never spam consecutive promo posts

---

## Queue item schema

```json
{
  "text": "Portal headliner updated on GatorVault — Eric Singleton Jr. now 5-11/165 per On3 🐊",
  "category": "news",
  "action": "post",
  "topic": "portal",
  "sources": [{ "outlet": "On3", "url": "https://www.on3.com/..." }],
  "scheduledAt": "2026-06-09T15:00:00.000Z"
}
```

Engagement reply example:

```json
{
  "text": "Huge get for the Swamp — depth at WR just got real.",
  "category": "engagement",
  "action": "reply",
  "inReplyToStatusId": "1234567890",
  "scheduledAt": "2026-06-09T16:00:00.000Z"
}
```

Promo example:

```json
{
  "text": "Monday depth chart is live in the Vault — real projections, not the official chart BS. Free trial → gatorvaultinsider.com 🐊",
  "category": "promo",
  "action": "post",
  "scheduledAt": "2026-06-10T12:00:00.000Z"
}
```

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/x/autoposter/policy` | Full content directive + mix targets |
| `GET` | `/api/x/autoposter/mix` | Rolling mix stats vs 50/30/20 |
| `POST` | `/api/x/autoposter/queue` | Schedule with `category`, `sources`, `action` |
| `POST` | `/api/x/autoposter/validate` | Dry-run validation without enqueue |

Validation runs automatically on enqueue and before the scheduler posts.

---

## Technical notes

- OAuth 1.0a for **all** posting actions (tweet, reply, quote, media)
- Beat stream remains read-only via Bearer token
- Scheduler processes queued posts by `scheduledAt`; mix stats guide editorial planning
- No AI-generated fake news or unsourced claims in production

---

## Verification checklist

- [ ] News post without sources → rejected
- [ ] Promo post without GatorVault mention → rejected
- [ ] Reply without `inReplyToStatusId` → rejected
- [ ] Mix endpoint shows drift from 50/30/20
- [ ] OAuth 1.0a verify passes on `/api/x/autoposter/status?probe=1`
