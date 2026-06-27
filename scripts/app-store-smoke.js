#!/usr/bin/env node
/** App Store demo-account smoke test (production). */
const API = process.env.GV_API_BASE || 'https://gatorvault-api.onrender.com';
const SITE = process.env.GV_SITE || 'https://gatorvaultinsider.com';
const EMAIL = (process.env.APP_REVIEW_EMAIL || 'appreview@gatorvaultinsider.com').trim().toLowerCase();
const PASSWORD = process.env.APP_REVIEW_PASSWORD || '';
const routes = [
  { n: 'privacy', url: '/privacy/' },
  { n: 'terms', url: '/terms/' },
  { n: 'futurecast', url: '/vault/futurecast/' },
  { n: 'recruiting', url: '/vault/recruiting/' },
  { n: 'team', url: '/vault/team/' },
  { n: 'community', url: '/vault/community/' },
  { n: 'membership', url: '/vault/membership/' },
  { n: 'live-feed', url: '/vault/live-feed/' },
];
const results = [];
const pass = (n, m) => results.push({ n, status: 'PASS', m });
const fail = (n, m) => results.push({ n, status: 'FAIL', m });

async function main() {
  if (!PASSWORD) { console.error('Set APP_REVIEW_PASSWORD'); process.exit(1); }
  for (const r of routes) {
    const res = await fetch(SITE + r.url);
    res.ok ? pass('page-' + r.n, String(res.status)) : fail('page-' + r.n, String(res.status));
  }
  const login = await fetch(API + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await login.json();
  if (!login.ok || !body.session?.token) fail('login', JSON.stringify(body));
  else {
    pass('login', body.session.tier || 'ok');
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
  }
  const catalog = await fetch(API + '/api/subscription/catalog');
  catalog.ok ? pass('catalog', 'ok') : fail('catalog', String(catalog.status));
  console.log(JSON.stringify({ email: EMAIL, results, pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length }, null, 2));
  process.exit(results.some(x => x.status === 'FAIL') ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });