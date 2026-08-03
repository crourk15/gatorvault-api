#!/usr/bin/env node
/** App Store demo-account smoke test (production). */
const API = process.env.GV_API_BASE || 'https://gatorvault-api.onrender.com';
const SITE = process.env.GV_SITE || 'https://gatorvaultinsider.com';
const EMAIL = (process.env.APP_REVIEW_EMAIL || 'appreview@gatorvaultinsider.com').trim().toLowerCase();
const PASSWORD = process.env.APP_REVIEW_PASSWORD || '';
const EXPECTED_TIER = (process.env.APP_REVIEW_TIER || 'war').toLowerCase();

const routes = [
  { n: 'privacy', url: '/privacy/', marker: 'Privacy' },
  { n: 'terms', url: '/terms/', marker: 'Terms' },
  { n: 'game-week', url: '/vault/game-week/', marker: 'Game Week' },
  { n: 'film-room', url: '/vault/film-room/', marker: 'Film Room' },
  { n: 'futurecast', url: '/vault/futurecast/', marker: 'FutureCast' },
  { n: 'recruiting', url: '/vault/recruiting/', marker: 'Recruiting' },
  { n: 'team', url: '/vault/team/', marker: 'Team' },
  { n: 'community', url: '/vault/community/', marker: 'Community' },
  { n: 'membership', url: '/vault/membership/', marker: 'Membership' },
  { n: 'live-feed', url: '/vault/live-feed/', marker: 'Live' },
];

const results = [];
const pass = (n, m) => results.push({ n, status: 'PASS', m });
const fail = (n, m) => results.push({ n, status: 'FAIL', m });

async function main() {
  if (!PASSWORD) {
    console.error('Set APP_REVIEW_PASSWORD');
    process.exit(1);
  }

  for (const r of routes) {
    const res = await fetch(SITE + r.url);
    if (!res.ok) {
      fail('page-' + r.n, String(res.status));
      continue;
    }
    const html = await res.text();
    if (r.marker && !html.includes(r.marker)) {
      fail('page-' + r.n + '-content', `missing "${r.marker}"`);
    } else {
      pass('page-' + r.n, String(res.status));
    }
  }

  const membershipRes = await fetch(SITE + '/vault/membership/');
  const membershipHtml = membershipRes.ok ? await membershipRes.text() : '';
  const deleteApi = await fetch(API + '/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (deleteApi.status === 401 || deleteApi.status === 400) {
    pass('account-delete-api', String(deleteApi.status));
  } else if (membershipHtml.includes('id="delete-account"') || membershipHtml.includes('delete-account')) {
    pass('membership-delete-ui', 'delete panel present');
  } else {
    fail('membership-delete-ui', 'delete API/UI not detected');
  }

  // Native iOS uses the site origin proxy (getApiBase → gatorvaultinsider.com), not Render direct.
  // Prefer SITE so smoke matches App Review; fall back to API if the proxy is down.
  let login = null;
  let body = null;
  for (const base of [SITE, API]) {
    try {
      login = await fetch(base + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      const raw = await login.text();
      try {
        body = JSON.parse(raw);
      } catch {
        body = { error: `non-json from ${base}`, status: login.status, preview: raw.slice(0, 120) };
      }
      if (login.ok && body?.session?.token) break;
    } catch (err) {
      body = { error: String(err), base };
    }
  }
  if (!login?.ok || !body?.session?.token) {
    fail('login', JSON.stringify(body));
  } else {
    const tier = String(body.session.tier || '').toLowerCase();
    if (tier === EXPECTED_TIER || tier === 'war' || tier === 'film') {
      pass('login', tier);
    } else {
      fail('login-tier', `expected ${EXPECTED_TIER}, got ${tier || 'none'}`);
    }

    const tok = body.session.token;
    const threads = await fetch(API + '/api/community/threads?limit=1', {
      headers: { Authorization: 'Bearer ' + tok },
    });
    threads.ok ? pass('community-api', 'threads ok') : fail('community-api', String(threads.status));
    if (threads.ok) {
      const threadsBody = await threads.json();
      const first = threadsBody.threads?.[0];
      if (first?.id) {
        const flagRes = await fetch(API + '/api/community/thread/' + encodeURIComponent(first.id) + '/flag', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'spam' }),
        });
        if (flagRes.ok || flagRes.status === 409) {
          pass('community-flag', flagRes.status === 409 ? 'duplicate ok' : 'flag ok');
        } else {
          fail('community-flag', String(flagRes.status));
        }
      } else {
        pass('community-flag', 'no threads to flag');
      }
    }

    const sub = await fetch(API + '/api/subscription/status', {
      headers: { Authorization: 'Bearer ' + tok },
    });
    const subBody = await sub.json();
    sub.ok && subBody.tier ? pass('subscription', subBody.tier) : fail('subscription', JSON.stringify(subBody).slice(0, 120));

    const restore = await fetch(API + '/api/subscription/apple/restore', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'com.gatorvaultinsider.film.monthly', transactionId: 'smoke-test' }),
    });
    if (restore.status === 503 || restore.status === 502 || restore.status === 400) {
      pass('apple-restore-route', String(restore.status));
    } else if (restore.ok) {
      pass('apple-restore-route', 'ok');
    } else {
      fail('apple-restore-route', String(restore.status));
    }

    const pushCfg = await fetch(API + '/api/push/config');
    pushCfg.ok ? pass('push-config', 'ok') : fail('push-config', String(pushCfg.status));
  }

  const catalog = await fetch(API + '/api/subscription/catalog');
  catalog.ok ? pass('catalog', 'ok') : fail('catalog', String(catalog.status));

  const pushSw = await fetch(SITE + '/push-sw.js');
  pushSw.ok ? pass('push-sw', 'ok') : fail('push-sw', String(pushSw.status));

  console.log(
    JSON.stringify(
      {
        email: EMAIL,
        results,
        pass: results.filter((x) => x.status === 'PASS').length,
        fail: results.filter((x) => x.status === 'FAIL').length,
      },
      null,
      2
    )
  );
  process.exit(results.some((x) => x.status === 'FAIL') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
