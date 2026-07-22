# Resend setup (elite drip — bypass EmailJS Save)

EmailJS dashboard **Save** can fail during their outages. Resend sends **raw HTML + real subjects** with no template editor.

## Charles — 5 minutes

1. Create account: https://resend.com
2. **API Keys → Create** → copy key
3. **Domains → Add** `gatorvaultinsider.com` (DNS records Resend shows)
   - Until domain verifies, you can use Resend's onboarding test sender only for your own inbox
4. Render → **gatorvault-api** → Environment:
   - `RESEND_API_KEY` = (your key)
   - `RESEND_FROM` = `GatorVault <onboarding@gatorvaultinsider.com>` (must match verified domain)
   - Optional: `RESEND_REPLY_TO` = `gatorvaultinsider@gmail.com`
5. **Manual Deploy** (or wait for auto-deploy)

## Verify

```bash
curl -sS https://gatorvault-api.onrender.com/api/email-status | jq '.preferredProvider,.resend,.hint'
```

Expect `preferredProvider: "resend"`.

Test welcome (needs your test PIN):

```bash
curl -sS -X POST https://gatorvault-api.onrender.com/api/test/welcome \
  -H 'Content-Type: application/json' \
  -H 'X-Test-Pin: YOUR_PIN' \
  -d '{"email":"you@example.com","name":"Charles"}'
```

## Priority

When `RESEND_API_KEY` is set, welcome + drip + trial convert use Resend first. EmailJS stays as fallback.
