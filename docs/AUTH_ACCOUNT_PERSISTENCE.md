# Auth account persistence (email / password)

## What was broken

Create Account and Sign In use the same email normalization and scrypt password hashing. The frequent **Incorrect email or password** after a successful signup was **not** a hash mismatch.

Member accounts were stored in `server/data/users.json` on the Render API filesystem. That path is **ephemeral** — Render redeploys/restarts wipe it. Only `appreview@gatorvaultinsider.com` was recreated on boot (`APP_REVIEW_PASSWORD`). Real fans' accounts disappeared, so later sign-in returned the generic incorrect-password error.

## Fix

1. **Persistent disk** on `gatorvault-api` (`render.yaml`):
   - Mount: `/var/data`
   - `GV_USERS_PATH=/var/data/users.json`
   - `GV_TRIAL_LEDGER_PATH=/var/data/trial-ledger.json`
2. **Atomic writes** in `user-store.js` / `trial-ledger.js`
3. **One-time migrate** from the old ephemeral file into the durable path when the durable file is empty
4. Clearer login error when the email has **no account** (`account_not_found`) vs wrong password

## After deploy

1. Confirm Render Blueprint sync attached the disk (Dashboard → gatorvault-api → Disks → `/var/data`).
2. Check API logs for: `[user-store] path= /var/data/users.json … durableEnv= true`
3. Fans whose accounts were already wiped must **Create account once more** with the same email (trial ledger still prevents a second free month when the ledger row survived; if ledger was also wiped, they get a normal new trial).

Do **not** change the App Review demo password without an explicit request.
