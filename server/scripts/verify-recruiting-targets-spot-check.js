#!/usr/bin/env node
/** Spot-check class targets routes + Team Hub pipeline class year on production. */
const API = process.env.GV_API_BASE || 'https://gatorvault-api.onrender.com';
const SITE = process.env.GV_SITE || 'https://gatorvaultinsider.com';

const results = [];
const pass = (name, message) => results.push({ name, status: 'PASS', message });
const fail = (name, message) => results.push({ name, status: 'FAIL', message });

async function checkTargetsRoute(year) {
  const res = await fetch(`${SITE}/vault/recruiting/${year}/targets/`);
  const html = await res.text();
  if (!res.ok) {
    fail(`targets-${year}-page`, `HTTP ${res.status}`);
    return;
  }
  if (!html.includes(`${year} Target Board`) && !html.includes(`rh-${year}-targets-board`)) {
    fail(`targets-${year}-page`, 'missing targets board shell');
    return;
  }
  pass(`targets-${year}-page`, String(res.status));
}

async function checkBoardYear(year) {
  const res = await fetch(`${API}/api/recruiting/board?class=${year}`);
  if (!res.ok) {
    fail(`board-${year}-api`, String(res.status));
    return;
  }
  const body = await res.json();
  const targets = (body.targets ?? body.players ?? []).length;
  const commits = (body.commits ?? []).length;
  if (Number(body.classYear) !== year) {
    fail(`board-${year}-api`, `classYear ${body.classYear}`);
    return;
  }
  pass(`board-${year}-api`, `${commits} commits, ${targets} targets`);
}

async function checkHighPriority(year) {
  const res = await fetch(`${API}/api/futurecast/high-priority?year=${year}`);
  if (!res.ok) {
    fail(`hp-${year}-api`, String(res.status));
    return;
  }
  const body = await res.json();
  const count = body.players?.length ?? body.count ?? 0;
  const narratives = body.movementNarratives?.length ?? 0;
  pass(`hp-${year}-api`, `${count} players, ${narratives} narratives`);
}

async function main() {
  try {
    const manifest = await fetch(`${SITE}/build-manifest.json`).then((r) => r.json());
    pass('build-manifest', `commit ${String(manifest.commit || '').slice(0, 7)}`);
  } catch (err) {
    fail('build-manifest', err instanceof Error ? err.message : String(err));
  }

  await checkTargetsRoute(2027);
  await checkTargetsRoute(2028);
  await checkBoardYear(2027);
  await checkBoardYear(2028);
  await checkHighPriority(2027);
  await checkHighPriority(2028);

  const summary = {
    site: SITE,
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
