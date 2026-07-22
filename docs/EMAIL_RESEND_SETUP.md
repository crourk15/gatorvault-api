# Resend setup (elite drip — bypass EmailJS Save)

EmailJS dashboard **Save** can fail during their outages. Resend sends **raw HTML + real subjects** with no template editor.

## Status (live)

- API prefers Resend when `RESEND_API_KEY` is set.
- **Current blocker:** `gatorvaultinsider.com` must be **verified** in Resend.
  - Unverified domain error: `The gatorvaultinsider.com domain is not verified`
  - Until verified, production **falls back to EmailJS** for fan sends.

## Charles — verify domain (required)

1. https://resend.com/domains → **Add Domain** → `gatorvaultinsider.com`
2. Add the DNS records Resend shows (usually SPF / DKIM / maybe DMARC) at your DNS host
3. Click **Verify** in Resend (can take a few minutes after DNS propagates)
4. Confirm Render env:
   - `RESEND_API_KEY` = send key
   - `RESEND_FROM` = `GatorVault <onboarding@gatorvaultinsider.com>`
   - `RESEND_REPLY_TO` = `gatorvaultinsider@gmail.com`
5. Re-test: `POST /api/welcome` should return `"provider":"resend"` (not `emailjs`)

### Temporary test-only sender

`onboarding@resend.dev` can only send to the Resend account owner email. It cannot deliver to fans. Do **not** use it in production `RESEND_FROM`.

## Verify API

```bash
curl -sS https://gatorvault-api.onrender.com/api/email-status | jq '.preferredProvider,.resend,.hint'
curl -sS -X POST https://gatorvault-api.onrender.com/api/welcome \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","name":"Test","tier":"locker"}'
```

Look for `"provider":"resend"`. If you see `"provider":"emailjs"` plus `resendError`, domain verify is still incomplete.

## Priority

When domain is verified + `RESEND_API_KEY` set, welcome + drip + trial convert use Resend first. EmailJS stays as fallback.
