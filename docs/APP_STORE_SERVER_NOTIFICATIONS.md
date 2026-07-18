# App Store Server Notifications (elite billing)

Production endpoint (already live on the API):

```
https://gatorvault-api.onrender.com/api/subscription/apple/notifications
```

## One-time setup in App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com) → **GatorVault Insider**
2. **App Information** (or **General** → App Information)
3. Scroll to **App Store Server Notifications**
4. **Production Server URL** → paste:
   `https://gatorvault-api.onrender.com/api/subscription/apple/notifications`
5. Version: **Version 2 Notifications**
6. Optional: set the same URL for **Sandbox**
7. Save

## What this unlocks

- Renewals keep paid access in sync
- Cancel auto-renew keeps access until period end
- Expire / refund / revoke remove access correctly
- Payloads are **cryptographically verified** (Apple JWS + Root CA)

## Health check

```
GET https://gatorvault-api.onrender.com/api/subscription/health
```

Expect `elite: true`, `appleIap.configured: true`, `notifications.jwsVerification: "required"`.
