#!/usr/bin/env node
/**
 * Production smoke test — canonical vault routes from vault-route-map.
 */
const https = require('https');
const http = require('http');
const vaultMap = require('../../client/lib/routes-vault.cjs');

const BASE = (process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');

const PLAYER_SLUGS = {
  recruiting: process.env.SMOKE_RECRUITING_SLUG || 'amare-patterson',
  futurecast: process.env.SMOKE_FC_SLUG || 'amare-patterson',
};

const ROUTES = [
  '/vault/schedule',
  '/vault/team',
  `/vault/recruiting/player/${PLAYER_SLUGS.recruiting}`,
  '/vault/recruiting/2026/commits',
  '/vault/recruiting/2027/commits',
  '/vault/recruiting/2026/targets',
  '/vault/recruiting/2027/targets',
  '/vault/recruiting/heat-check',
  '/vault/recruiting/scouting',
  '/vault/recruiting/portal',
  '/vault/recruiting/movement',
  '/vault/futurecast/board',
  '/vault/futurecast/movement',
  '/vault/futurecast/staff',
  `/vault/futurecast/player/${PLAYER_SLUGS.futurecast}`,
  '/vault/film-room/scheme',
  '/vault/film-room/breakdowns',
  '/vault/film-room/press',
  '/vault/film-room/highlights',
  '/vault/live-feed/headlines',
  '/vault/live-feed/beat',
  '/vault/live-feed/podcasts',
];

const MARKERS = {
  '/vault/schedule': ['vault-schedule', 'Schedule'],
  '/vault/team': ['vault-team', 'gv-team-page'],
  '/vault/recruiting': ['vault-recruiting-hub', 'Recruiting Hub'],
  '/vault/futurecast': ['vault-futurecast', 'FutureCast'],
  '/vault/film-room': ['vault-film-room', 'gv-film-room'],
  '/vault/live-feed': ['vault-live-feed', 'gv-live-feed'],
};

function markerForPath(path) {
  const clean = path.replace(/\/player\/[^/]+$/, '').replace(/\/[^/]+\/[^/]+$/, (m) => {
    if (/\/\d{4}\//.test(path) || /heat-check|scouting|portal|movement|headlines|beat|podcasts|scheme|breakdowns|press|highlights|board|staff|football/.test(path)) {
      return path.slice(0, path.lastIndexOf('/'));
    }
    return path;
  });
  for (const [prefix, markers] of Object.entries(MARKERS)) {
    if (path.startsWith(prefix) || clean.startsWith(prefix)) return markers;
  }
  if (path.includes('/recruiting/player/')) return ['player-profile', 'recruiting'];
  if (path.includes('/futurecast/player/')) return ['player-profile', 'FutureCast'];
  return ['gv-vault-shell'];
}

function fetchUrl(url, { maxRedirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'GatorVault-SmokeTest/1.0' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetchUrl(next, { maxRedirects: maxRedirects - 1 }));
      }
      let body = '';
      res.on('data', (c) => {
        body += c;
        if (body.length > 500000) res.destroy();
      });
      res.on('end', () => resolve({ status: res.statusCode, body, url }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function testRoute(path) {
  const url = `${BASE}${path}`;
  try {
    const { status, body } = await fetchUrl(url);
    const markers = markerForPath(path);
    const found = markers.filter((m) => body.includes(m));
    const monolith = ['vpane-start', 'gvOpenTeamDetail'].some((p) => body.includes(p));
    const ok = status === 200 && found.length > 0 && !monolith;
    return {
      path,
      status,
      ok,
      markers: found,
      missing: markers.filter((m) => !body.includes(m)),
      monolith,
      error: ok ? null : status !== 200 ? `HTTP ${status}` : monolith ? 'monolith hooks' : `missing markers: ${markers.join(', ')}`,
    };
  } catch (err) {
    return { path, status: 0, ok: false, error: err.message };
  }
}

async function main() {
  console.log(`[smoke] Production base: ${BASE}`);
  console.log(`[smoke] Testing ${ROUTES.length} canonical routes...\n`);

  const results = [];
  for (const path of ROUTES) {
    const r = await testRoute(path);
    results.push(r);
    const icon = r.ok ? '✓' : '✗';
    console.log(`${icon} ${path} — ${r.ok ? `200 (${r.markers.join(', ')})` : r.error}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n[smoke] ${passed}/${results.length} passed`);

  if (failed.length) {
    console.log('\n[smoke] Failures:');
    failed.forEach((f) => console.log(`  - ${f.path}: ${f.error}`));
    process.exitCode = 1;
  } else {
    console.log('[smoke] All canonical routes OK — React foundation verified.');
  }
}

main().catch((e) => {
  console.error('[smoke] crashed:', e.message);
  process.exitCode = 1;
});
