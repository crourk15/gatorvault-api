# Submit 1.0.9 (Build 43) — Community thread open fix

**Why:** TestFlight 1.0.9 showed Community questions, but opening a thread showed “Could not load this thread.”

## Root causes

1. API CORS for Capacitor (`capacitor://localhost`) reflected Origin but omitted `Access-Control-Allow-Credentials`, so credentialed Community detail fetches can fail in the WebView
2. Thread open only fell back to **seed** IDs — the daily open thread (`thr_daily_*`) is live-only, so a failed detail fetch showed empty
3. `/vault/community/*` rewrite swallowed `/vault/community/thread/:id` (no dedicated thread shell rewrite / native catch-all)

## Fix

- Server: `Access-Control-Allow-Credentials: true` when reflecting allowed Origins
- Client: optimistic OP from the in-memory list/seed; keep it if detail fetch fails
- Routes: `/vault/community/thread/*` → thread index; native SPA catch-all for community threads

## iOS

- `MARKETING_VERSION = 1.0.9`
- `CURRENT_PROJECT_VERSION = 43`

## Ops

1. Deploy API (Render) so CORS fix is live — helps current TestFlight without waiting on a new binary
2. Codemagic → TestFlight **43** for the client/routing harden
