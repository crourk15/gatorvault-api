# Auth account persistence (email / password)

## What was broken

Create Account and Sign In used the same email normalization and scrypt password hashing. The frequent **Incorrect email or password** after a successful signup was **not** a hash mismatch.

Member accounts were stored in `server/data/users.json` on the Render API filesystem. That path is **ephemeral** — Render redeploys/restarts wipe it. Only `appreview@gatorvaultinsider.com` was recreated on boot (`APP_REVIEW_PASSWORD`). Real fans' accounts disappeared, so later sign-in returned the generic incorrect-password error.

## Fix

1. **Persistent disk** on `gatorvault-api` (`render.yaml`):
   - Mount: `/var/data`
   - `GV_USERS_PATH=/var/data/users.json`
   - `GV_TRIAL_LEDGER_PATH=/var/data/trial-ledger.json`
2. **Atomic writes** in `user-store.js` / `trial-ledger.js`
3. **One-time migrate** from the old ephemeral file into the durable path when the durable file is empty
4. Clearer login error when the email has **no account** (`account_not_found`) vs wrong password

## Confirm after deploy

```bash
curl -sS https://gatorvault-api.onrender.com/api/auth/store-status | python3 -m json.tool
```

Expect:

- `confirmed: true`
- `auth.durableEnv: true`
- `auth.pathIsDurable: true`
- `auth.diskMountPresent: true`

Also: Dashboard → gatorvault-api → Disks → `/var/data`, and API logs for `[user-store] path= /var/data/users.json … durableEnv= true`.

Capacity prep for ~500 members (write races, rate limits, points durability): `docs/CAPACITY_500_MEMBERS.md`.

Fans whose accounts were already wiped must **Create Account once more** with the same email (trial ledger still prevents a second free month when the ledger row survives; if the ledger was also wiped, they get a normal new trial).

Do **not** change the App Review demo password without an explicit request.
