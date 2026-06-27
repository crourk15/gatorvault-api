#!/usr/bin/env node
/**
 * Post-deploy smoke test — verify live site + API after deploy.
 *
 * Usage:
 *   node scripts/deploy-smoke-post.js
 *   SITE_URL=https://gatorvaultinsider.com API_URL=https://gatorvault-api.onrender.com node scripts/deploy-smoke-post.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const SITE_URL = (process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
const API_URL = (process.env.API_URL || process.env.DEPLOY_GUARDIAN_API_URL || 'https://gatorvault-api.onrender.com').replace(
  /\/$/,
  ''
);
const PORTAL_SMOKE_SLUG = process.env.SMOKE_PORTAL_SLUG || 'test-slug';
const CRAWLER_UA = 'GatorVault-QA-Crawler/1.0';

const VAULT_SMOKE_PATHS = [
  '/vault',
  '/vault/recruiting',
  '/vault/live',
  '/vault/team',
  '/vault/futurecast',
  '/vault/film-room',
  '/vault/schedule',
];

async function fetchJsonCheck(label, url, { validate } = {}) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': CRAWLER_UA } });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) return { ok: false, label, error: `HTTP ${res.status}`, url };
    if (typeof validate === 'function') {
      const validationError = validate(body);
      if (validationError) return { ok: false, label, error: validationError, url };
    }
    return { ok: true, label, status: res.status, url };
  } catch (err) {
    return { ok: false, label, error: err.message, url };
  }
}

async function fetchCheck(label, url, { allow404 = false, expectIncludes = [], headers = {} } = {}) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers });
    const text = await res.text();
    const failed = !res.ok && !(allow404 && res.status === 404);
    const missing = expectIncludes.filter((s) => !text.includes(s));
    if (failed) return { ok: false, label, error: `HTTP ${res.status}`, url };
    if (missing.length) return { ok: false, label, error: `missing: ${missing.join(', ')}`, url };
    return { ok: true, label, status: res.status, url };
  } catch (err) {
    return { ok: false, label, error: err.message, url };
  }
}

async function checkAlertsFlipWatchUfAlignment() {
  const label = 'api-futurecast-alerts-uf';
  try {
    const [alertsRes, hpRes] = await Promise.all([
      fetch(`${API_URL}/api/futurecast/alerts`, { headers: { 'User-Agent': CRAWLER_UA } }),
      fetch(`${API_URL}/api/futurecast/high-priority?year=2027`, { headers: { 'User-Agent': CRAWLER_UA } }),
    ]);
    const alertsBody = await alertsRes.json();
    const hpBody = await hpRes.json();
    if (!alertsRes.ok) return { ok: false, label, error: `alerts HTTP ${alertsRes.status}`, url: `${API_URL}/api/futurecast/alerts` };
    if (!hpRes.ok) return { ok: false, label, error: `high-priority HTTP ${hpRes.status}`, url: `${API_URL}/api/futurecast/high-priority?year=2027` };

    const alerts = Array.isArray(alertsBody) ? alertsBody : alertsBody.alerts || [];
    const flipAlerts = alerts.filter((a) => a.type === 'flip_watch');
    if (!flipAlerts.length) return { ok: false, label, error: 'no flip_watch alerts', url: `${API_URL}/api/futurecast/alerts` };

    const ufZero = flipAlerts.filter((a) => /UF 0%/.test(String(a.message || '')));
    if (ufZero.length) return { ok: false, label, error: 'flip_watch includes UF 0%', url: `${API_URL}/api/futurecast/alerts` };

    const hpBySlug = new Map((hpBody.flipWatch || []).map((row) => [String(row.slug || '').toLowerCase(), row]));
    for (const alert of flipAlerts) {
      const slug = String(alert.playerSlug || '').toLowerCase();
      const hp = hpBySlug.get(slug);
      if (!hp || hp.ufProbability == null) continue;
      const expected = `UF ${hp.ufProbability}%`;
      if (!String(alert.message || '').includes(expected)) {
        return {
          ok: false,
          label,
          error: `${slug} alert missing ${expected} (got: ${alert.message})`,
          url: `${API_URL}/api/futurecast/alerts`,
        };
      }
    }
    return { ok: true, label, url: `${API_URL}/api/futurecast/alerts` };
  } catch (err) {
    return { ok: false, label, error: err.message, url: `${API_URL}/api/futurecast/alerts` };
  }
}

async function main() {
  const checks = [];

  for (const vaultPath of VAULT_SMOKE_PATHS) {
    checks.push(
      await fetchCheck(`vault-route${vaultPath.replace(/\//g, '-')}`, `${SITE_URL}${vaultPath}`, {
        headers: { 'User-Agent': CRAWLER_UA },
        expectIncludes: ['GatorVault'],
      })
    );
  }

  checks.push(
    await fetchCheck('vault-futurecast', `${SITE_URL}/vault/futurecast/`, {
      headers: { 'User-Agent': CRAWLER_UA },
      expectIncludes: ['FutureCast', 'futurecast'],
    }),
    await fetchCheck('recruiting-player-profile', `${SITE_URL}/vault/recruiting/player/${PORTAL_SMOKE_SLUG}/`, {
      allow404: true,
      headers: { 'User-Agent': CRAWLER_UA },
      expectIncludes: ['recruiting', 'Recruiting'],
    }),
    await fetchCheck('api-futurecast-home', `${API_URL}/api/futurecast/home`, {
      expectIncludes: ['trendingUp', 'commits'],
    }),
    await fetchCheck('api-futurecast-staff-notes', `${API_URL}/api/futurecast/staff-notes?year=2027`, {
      expectIncludes: ['notes', 'classYear'],
    }),
    await fetchCheck('api-futurecast-high-priority', `${API_URL}/api/futurecast/high-priority?year=2027`, {
      expectIncludes: ['players', 'priorityScore', 'compositeScore'],
    }),
    await fetchJsonCheck('api-futurecast-visit-intel', `${API_URL}/api/futurecast/high-priority?year=2027`, {
      validate(body) {
        if (!Array.isArray(body?.flipWatch)) return 'missing flipWatch[]';
        if (!Array.isArray(body?.visitRecap)) return 'missing visitRecap[]';
        if (!Array.isArray(body?.movementNarratives)) return 'missing movementNarratives[]';
        const withTrend = (body.players || []).some((p) => (p.trendHistory || []).length >= 2);
        if (!withTrend) return 'no player trendHistory with >= 2 points';
        const gapFill = (body.players || []).find((p) =>
          ['raheem-floyd', 'jalen-brewster', 'easton-royal'].includes(p.slug)
        );
        const on3Predictor = (gapFill?.predictors || []).some(
          (p) => String(p?.name || '').includes('On3') && Number(p?.score) > 0
        );
        if (!on3Predictor) {
          return 'allowlist gap-fill target missing On3 RPM predictor (raheem-floyd/jalen-brewster/easton-royal)';
        }
        return null;
      },
    }),
    await fetchJsonCheck('api-push-config', `${API_URL}/api/push/config`, {
      validate(body) {
        if (typeof body?.enabled !== 'boolean') return 'missing enabled boolean';
        if (body.enabled && !body.publicKey) return 'enabled but missing publicKey';
        return null;
      },
    }),
    await fetchJsonCheck('site-push-config-proxy', `${SITE_URL}/api/push/config`, {
      validate(body) {
        if (typeof body?.enabled !== 'boolean') return 'missing enabled boolean';
        return null;
      },
    }),
    await fetchCheck('push-service-worker', `${SITE_URL}/push-sw.js`, {
      headers: { 'User-Agent': CRAWLER_UA },
      expectIncludes: ['gv-visit-intel', 'showNotification'],
    }),
    await fetchCheck('vault-alerts-page', `${SITE_URL}/vault/alerts/`, {
      headers: { 'User-Agent': CRAWLER_UA },
      expectIncludes: ['Verified UF official visit', 'vault-alerts'],
    }),
    await fetchJsonCheck('api-futurecast-health', `${API_URL}/api/futurecast/health`, {
      validate(body) {
        if (!body?.ok) return 'futurecast health not ok';
        if (!body?.connected) return 'postgres not connected';
        if ((body.players || 0) < 400) return `expected >=400 players, got ${body.players}`;
        return null;
      },
    }),
    await fetchJsonCheck('api-big-board', `${API_URL}/api/big-board?class_year=2027&limit=5`, {
      validate(body) {
        if (!Array.isArray(body?.players)) return 'missing players[] on /api/big-board';
        if (!body.players.length) return 'big-board returned zero players';
        const withFit = body.players.filter((p) => Number(p.ufFitScore) >= 50);
        if (!withFit.length) return 'no 2027 big-board player with ufFitScore >= 50 (run seed:uf-fit)';
        return null;
      },
    }),
    await fetchJsonCheck('api-uf-fit-watchlist', `${API_URL}/api/uf-fit/watchlist?class_year=2027&limit=5`, {
      validate(body) {
        if (!Array.isArray(body?.players)) return 'missing players[] on /api/uf-fit/watchlist';
        if (!body.players.length) return 'uf-fit watchlist empty for 2027 (run seed:uf-fit)';
        return null;
      },
    }),
    await fetchJsonCheck('api-early-discovery', `${API_URL}/api/futurecast/early-discovery?class_year_gte=2028&limit=5`, {
      validate(body) {
        if (!body?.ok) return 'early-discovery not ok';
        if (!Array.isArray(body?.players)) return 'missing players[] on /api/futurecast/early-discovery';
        const withScore = body.players.filter((p) => Number(p.discoveryScore) >= 50);
        if (!withScore.length) return 'no 2028 early-discovery player with discoveryScore >= 50 (run engine:early-discovery)';
        return null;
      },
    }),
    await fetchJsonCheck('api-early-discovery-allowlist', `${API_URL}/api/futurecast/early-discovery?class_year_gte=2028&min_discovery_score=50&limit=100`, {
      validate(body) {
        if (!Array.isArray(body?.players)) return 'missing players[] on 2028 early-discovery allowlist merge';
        if (body.players.length < 20) return `expected >=20 2028 early-discovery players, got ${body.players.length}`;
        const allowlist = body.players.filter((p) => p.allowlistTarget === true);
        if (allowlist.length < 20) return `expected >=20 allowlistTarget rows, got ${allowlist.length}`;
        const brysen = body.players.find((p) => p.slug === 'brysen-wright');
        if (!brysen?.allowlistTarget) return 'brysen-wright missing allowlistTarget in early-discovery';
        if (Number(brysen.ufProbability) <= 0) return 'brysen-wright missing ufProbability in early-discovery allowlist merge';
        return null;
      },
    }),
    await fetchJsonCheck('api-futurecast-high-priority-2028', `${API_URL}/api/futurecast/high-priority?year=2028`, {
      validate(body) {
        if (!Array.isArray(body?.players)) return 'missing players[] on 2028 high-priority';
        if (body.players.length < 5) return `expected >=5 2028 HP players, got ${body.players.length}`;
        const withUf = body.players.filter((p) => Number(p.ufProbability) > 0);
        const withFit = body.players.filter((p) => Number(p.fitScore) > 0);
        if (!withUf.length) return '2028 HP players missing ufProbability (check allowlist-board merge)';
        if (!withFit.length) return '2028 HP players missing fitScore (check allowlist-board merge)';
        const ufValues = new Set(withUf.map((p) => Number(p.ufProbability)));
        if (ufValues.size < 2) return '2028 HP ufProbability not varied (expected seeded allowlist values)';
        return null;
      },
    }),
    await fetchJsonCheck('api-recruiting-board-2028', `${API_URL}/api/recruiting/board?class=2028`, {
      validate(body) {
        if (!Array.isArray(body?.targets)) return 'missing targets[] on 2028 recruiting board';
        if (body.targets.length < 20) return `expected >=20 2028 targets, got ${body.targets.length}`;
        const withUf = body.targets.filter((p) => Number(p.ufProbability) > 0);
        const withFit = body.targets.filter((p) => Number(p.fitScore) > 0);
        if (!withUf.length) return '2028 recruiting targets missing ufProbability (check target-board-enrich)';
        if (!withFit.length) return '2028 recruiting targets missing fitScore (check target-board-enrich)';
        return null;
      },
    }),
    await fetchCheck('vault-futurecast-big-board', `${SITE_URL}/vault/futurecast/big-board/`, {
      headers: { 'User-Agent': CRAWLER_UA },
      expectIncludes: ['FutureCast Big Board', 'vault-futurecast-big-board'],
    }),
    await fetchJsonCheck('api-players-slug-futurecast', `${API_URL}/api/players/slug/raheem-floyd`, {
      validate(body) {
        if (!body?.player?.slug) return 'missing player.slug on /api/players/slug/:slug';
        return null;
      },
    }),
    await fetchCheck('api-recruits-2027', `${API_URL}/api/recruits/2027`, {
      expectIncludes: ['ok', 'recruits', 'compositeScore'],
    }),
    await fetchCheck('build-manifest', `${SITE_URL}/build-manifest.json`, {
      expectIncludes: ['buildId'],
    })
  );

  checks.push(await checkAlertsFlipWatchUfAlignment());

  const htmlRes = await fetch(`${SITE_URL}/vault/futurecast/`);
  const html = await htmlRes.text();
  if (html.includes('gv-vault-public-tabs') && html.includes('Start Here')) {
    checks.push({
      ok: false,
      label: 'vault-nav-separation',
      error: 'FutureCast page HTML still contains legacy public vtab markup (stale bundle?)',
      url: `${SITE_URL}/vault/futurecast/`,
    });
  } else {
    checks.push({ ok: true, label: 'vault-nav-separation' });
  }

  const failed = checks.filter((c) => !c.ok);
  const result = {
    ok: failed.length === 0,
    site: SITE_URL,
    api: API_URL,
    checks,
    failed: failed.map((f) => ({ label: f.label, error: f.error, url: f.url })),
    checkedAt: new Date().toISOString(),
  };

  try {
    require('../lib/deploy-monitor').recordSmokeTest(result);
  } catch {
    /* optional */
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('[deploy-smoke] Post-deploy —', result.ok ? 'PASS' : 'FAIL');
    for (const c of checks) {
      console.log(c.ok ? '  ✓' : '  ✗', c.label, c.error || '');
    }
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('[deploy-smoke] fatal:', err.message);
  process.exit(1);
});
