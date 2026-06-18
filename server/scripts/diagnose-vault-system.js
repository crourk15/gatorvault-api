#!/usr/bin/env node
/**
 * GatorVault system diagnostic — run from server/:
 *   node scripts/diagnose-vault-system.js
 *   node scripts/diagnose-vault-system.js --slug=davian-groce --on3=175389
 *   node scripts/diagnose-vault-system.js --api=https://gatorvault-api.onrender.com
 *
 * Prints sections 2–4 (API + server) in a copy-paste packet.
 * Section 1 (browser console) must be captured manually — see output footer.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = (
  process.argv.find((a) => a.startsWith('--api='))?.split('=').slice(1).join('=') ||
  process.env.API_BASE ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://gatorvault-api.onrender.com'
).replace(/\/$/, '');

const slugArg = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1] || 'davian-groce';
const on3Arg = process.argv.find((a) => a.startsWith('--on3='))?.split('=')[1] || '175389';

const pg = require('../lib/pipeline-guards');
const autoposter = require('../lib/x-autoposter');

async function fetchProbe(label, path) {
  const url = `${API_BASE}${path}`;
  const row = { label, requestUrl: url, statusCode: null, responseBody: null, error: null };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    row.statusCode = res.status;
    const text = await res.text();
    try {
      row.responseBody = JSON.parse(text);
    } catch {
      row.responseBody = text.slice(0, 800);
    }
  } catch (err) {
    row.error = err instanceof Error ? err.message : String(err);
  }
  return row;
}

function printSection(title, body) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
  console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

async function main() {
  console.log(`GatorVault diagnostic packet — ${new Date().toISOString()}`);
  console.log(`API base: ${API_BASE}`);

  // --- Section 2: Network / API ---
  const probes = await Promise.all([
    fetchProbe('resolve slug (recruiting)', `/api/player/resolve/${encodeURIComponent(slugArg)}?context=recruiting`),
    fetchProbe('resolve On3 id (recruiting)', `/api/player/resolve/${encodeURIComponent(on3Arg)}?context=recruiting`),
    fetchProbe('full profile by slug', `/api/player/full-profile/${encodeURIComponent(slugArg)}`),
    fetchProbe('hub player by slug', `/api/recruiting/player/${encodeURIComponent(slugArg)}`),
    fetchProbe('hub player by On3 id', `/api/recruiting/player/${encodeURIComponent(on3Arg)}`),
    fetchProbe('autoposter status', '/api/x/autoposter/status'),
    fetchProbe('recruiting class 2027', '/api/recruiting/class/2027'),
    fetchProbe('high-priority intel', '/api/recruiting/intel/high-priority')
  ]);

  printSection('2. NETWORK / API PROBES', probes);

  // --- Section 3: Server env + local state ---
  let localResolve = null;
  let localResolveError = null;
  try {
    const { resolvePlayerSlugRecord } = require('../api/player/build-full-profile.ts');
    localResolve = await resolvePlayerSlugRecord(slugArg, 'recruiting');
  } catch (err) {
    localResolveError = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 8).join('\n') : null,
      note: 'TS module may need npx tsx on some machines; API probes above are authoritative for production.'
    };
  }

  const serverState = {
    env: {
      X_PIPELINES_ENABLED: process.env.X_PIPELINES_ENABLED ?? '(unset)',
      X_AUTOPOST_ENABLED: process.env.X_AUTOPOST_ENABLED ?? '(unset)',
      X_GM2_REWRITE_ENABLED: process.env.X_GM2_REWRITE_ENABLED ?? '(unset)',
      X_INTEL_REWRITE_ENABLED: process.env.X_INTEL_REWRITE_ENABLED ?? '(unset)',
      X_SCHEDULED_JOBS_ENABLED: process.env.X_SCHEDULED_JOBS_ENABLED ?? '(unset)',
      DATABASE_URL: process.env.DATABASE_URL ? '(set)' : '(unset)',
      NODE_ENV: process.env.NODE_ENV ?? '(unset)'
    },
    pipelineGuards: {
      pipelinesEnabled: pg.pipelinesEnabled(),
      autopostEnabled: pg.autopostEnabled(),
      gm2RewriteEnabled: pg.gm2RewriteEnabled(),
      intelRewriteEnabled: pg.intelRewriteEnabled()
    },
    autoposterConfig: autoposter.getConfigStatus(),
    localResolve: localResolve || localResolveError
  };

  printSection('3. SERVER STATE (local .env + guards)', serverState);

  // --- Section 4: URL routing map ---
  const urlMap = {
    exampleFailure: {
      clicked: `/vault/recruiting/player/${on3Arg}`,
      navigatedTo: `/vault/recruiting/player/${on3Arg}`,
      expectedAfterFix: `/vault/recruiting/player/${slugArg}`,
      clientResolveCalls: [
        `GET ${API_BASE}/api/player/resolve/${on3Arg}?context=recruiting`,
        `GET ${API_BASE}/api/player/full-profile/${slugArg}`
      ],
      staticExportNote:
        'Netlify serves /vault/recruiting/player/* via catch-all; slug is read from window.location.pathname in RecruitingPlayerClient.'
    },
    profileRoutes: {
      recruiting: `/vault/recruiting/player/{slug}`,
      futurecast: `/vault/futurecast/player/{slug}`,
      roster: `/vault/players/{slug}`,
      portal: `/vault/portal/player/{slug}`
    },
    errorUi: {
      missingSlug: 'UiError title "Player not found" — RecruitingPlayerClient when pathname has no slug',
      resolveFailed: 'UiError title "Player not found" message from ApiFetchError (404/500 body.error)',
      profileLoadFailed: 'PlayerProfilePage UiError after resolve succeeds but full-profile fetch fails',
      reactCrash: 'VaultErrorBoundary logs [VaultErrorBoundary] + componentStack in console'
    }
  };

  printSection('4. URL / ROUTING REFERENCE', urlMap);

  console.log('\n' + '='.repeat(72));
  console.log('1. BROWSER CONSOLE — capture manually');
  console.log('='.repeat(72));
  console.log(`
Steps:
  1. Open site → F12 → Console + Network (Preserve log ON)
  2. Reproduce the broken click
  3. Copy ALL red console lines + stack traces
  4. In Network, filter "Fetch/XHR", click failing request, copy:
       Request URL / Status / Response (Preview or Response tab)
  5. Note final address bar URL vs link href

Paste into ticket with this script output.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
