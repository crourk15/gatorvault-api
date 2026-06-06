# GatorVault — Beehiiv Onboarding Automation Setup

Replace the old 3-email sequence with this **7-email** onboarding flow (Days 0, 1, 3, 5, 7, 10, 14).

## 1. Render environment variables

Add to **gatorvault-api** on Render:

| Variable | Description |
|----------|-------------|
| `BEEHIIV_API_KEY` | Beehiiv API key (Settings → API) |
| `BEEHIIV_PUBLICATION_ID` | Publication ID (`pub_…`) |
| `BEEHIIV_ONBOARDING_AUTOMATION_ID` | Automation ID (`aut_…`) after you build the flow |

## 2. Disable Beehiiv default welcome email

**Settings → Emails → Preset Emails** → turn OFF the standalone welcome email (avoids duplicate Day 0).

## 3. Create the automation

**Audience → Automations → Create automation**

- **Trigger:** `Added by API` (required for GatorVault signup enrollment)
- **Name:** `GatorVault Onboarding`

### Email steps (add Send Email + Wait between each)

| Step | Wait after previous | Subject |
|------|---------------------|---------|
| 1 — Day 0 | — (immediate) | Welcome to GatorVault — Your Insider Access Is Live 🐊 |
| 2 — Day 1 | 1 day | Your GatorVault Playbook — Start Here |
| 3 — Day 3 | 2 days | Why GatorVault Was Built (And What Makes It Different) |
| 4 — Day 5 | 2 days | What's the ONE thing you want answered? |
| 5 — Day 7 | 2 days | Your Trial Checklist — Don't Miss These |
| 6 — Day 10 | 3 days | You're 10 Days In — Here's What You've Unlocked |
| 7 — Day 14 | 4 days | Your Trial Ends Soon — Don't Lose Access |

Copy full email body + CTA text from `server/lib/onboarding-emails.js` (`ONBOARDING_SEQUENCE`), or run:

```bash
node scripts/export-onboarding-html.js
```

HTML files are written to `server/email/onboarding/` for paste into Beehiiv email blocks.

## 4. Copy automation ID to Render

After publishing the automation, copy its ID → set `BEEHIIV_ONBOARDING_AUTOMATION_ID` on Render → redeploy.

## 5. How signup works

1. User registers on GatorVault
2. API calls `POST /v2/publications/{pub}/subscriptions` with `send_welcome_email: false` and `automation_ids: [your_automation]`
3. Beehiiv enrolls the subscriber and runs the timed sequence automatically
4. If Beehiiv is not configured, Day 0 falls back to EmailJS with the new welcome copy

## 6. Test

```bash
# Local — after .env is set
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you+test@example.com","password":"testpass12","name":"Test","tier":"film"}'
```

Check Beehiiv **Audience → Subscribers** and **Automations → Journeys** for enrollment.
