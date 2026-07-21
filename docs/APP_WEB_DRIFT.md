# Web ↔ App drift (how UI updates reach TestFlight)

## Rule

The App Store / TestFlight binary is a **bundled** Capacitor shell (`client/out` copied at Codemagic build time).
**Netlify deploys do not update the installed app.** That is intentional for App Store guideline **4.2.2** (no remote HTML shell).

## How to ship UI fixes to the app

1. Merge to `main` (web goes live via Netlify).
2. Bump `CURRENT_PROJECT_VERSION` when needed.
3. Run Codemagic **ios-release** on `main` (or rely on `.github/workflows/ios-testflight-on-main.yml` when secrets are set).
4. Install the new TestFlight build.

## Automation

- Workflow: `.github/workflows/ios-testflight-on-main.yml`
- Secrets: `CODEMAGIC_API_TOKEN`, `CODEMAGIC_APP_ID`
- Manual: `npm run trigger:codemagic:ios`
- Codemagic publishing should stay **TestFlight-only** (`submit_to_app_store: false`) unless you intentionally submit a review build.

## Not the fix

Do **not** set `CAPACITOR_SERVER_URL` / `server.url` for App Store builds. Codemagic fails the build if that sneaks in.
