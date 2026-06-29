#!/usr/bin/env node
/**
 * Production smoke: Recruiting Hub 2028 APIs (movement feed + underclassmen).
 */
const API = process.env.GV_API_BASE || 'https://gatorvault-api.onrender.com';

const results = [];
const pass = (name, message) => results.push({ name, status: 'PASS', message });
const fail = (name, message) => results.push({ name, status: 'FAIL', message });

async function main() {
  const feedRes = await fetch(`${API}/api/recruiting/hub/movement-feed?year=2028`);
  const feed = await feedRes.json().catch(() => ({}));
  const items = feed.items || [];
  if (!feedRes.ok) fail('movement-feed-2028', `HTTP ${feedRes.status}`);
  else if (!items.length) fail('movement-feed-2028', 'empty feed');
  else {
    const commits = items.filter((i) => i.event === 'commit').length;
    const narr = items.filter((i) => i.movementNarrative).length;
    pass('movement-feed-2028', `${items.length} items, ${commits} commits, ${narr} narratives`);
    if (narr === 0) {
      fail('movement-narratives', 'no UF delta narratives on feed (check uf-trend snapshots)');
    } else {
      pass('movement-narratives', `${narr} items with movementNarrative`);
    }
  }

  const ucRes = await fetch(`${API}/api/futurecast/underclassmen?years=2028`);
  const uc = await ucRes.json().catch(() => ({}));
  const bucket = uc.classes?.['2028'];
  const targets = bucket?.targets?.length || 0;
  if (!ucRes.ok) fail('underclassmen-2028', `HTTP ${ucRes.status}`);
  else if (targets < 5) fail('underclassmen-2028', `only ${targets} targets`);
  else pass('underclassmen-2028', `${targets} locked targets`);

  const summary = {
    api: API,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
