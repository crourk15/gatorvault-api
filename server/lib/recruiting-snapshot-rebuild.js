/**
 * Rebuild page + hub JSON snapshots from recruiting store (run at deploy or after ingest locally).
 */
const path = require('path');

async function rebuildPageSnapshots() {
  process.chdir(path.join(__dirname, '..'));
  const { main } = require('./page-snapshot-builders');
  await main();
  return { ok: true };
}

async function rebuildHubSnapshots() {
  process.chdir(path.join(__dirname, '..'));
  const fs = require('fs');
  const ROOT = path.join(__dirname, '..');
  const OUT = path.join(ROOT, 'hub-snapshot');
  const YEARS = [2026, 2027, 2028];
  const elite = require('./recruiting-hub-elite');

  const ENDPOINTS = [
    { file: 'ticker', build: (e, y) => e.buildHubTicker(y), items: true },
    { file: 'class-overview', build: (e, y) => e.buildHubClassOverview(y), spread: true },
    { file: 'commits', build: (e, y) => e.buildHubCommits(y), items: true },
    { file: 'battles', build: (e, y) => e.buildHubBattles(y), items: true },
    { file: 'positions', build: (e, y) => e.buildHubPositions(y), items: true },
    { file: 'heat-index', build: (e, y) => e.buildHubHeatIndex(y), items: true },
    { file: 'movement-feed', build: (e, y) => e.buildHubMovementFeed(y), items: true },
    { file: 'battle-board', build: (e, y) => e.buildHubBattleBoard(y), items: true },
    { file: 'footprint', build: (e, y) => e.buildHubFootprint(y), spread: true },
  ];

  function meta(endpoint, year) {
    return {
      generatedAt: new Date().toISOString(),
      snapshot: true,
      endpoint,
      year: year ?? null,
      source: 'recruiting-snapshot-rebuild',
    };
  }

  function wrapPayload({ spread, items, value, endpoint, year }) {
    const base = { ok: true, status: 'ready', meta: meta(endpoint, year) };
    if (spread) return { ...base, ...value };
    if (items) return { ...base, items: value };
    return { ...base, ...value };
  }

  if (fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT, { recursive: true });

  const allOverview = await elite.buildHubClassOverviewAll();
  fs.writeFileSync(
    path.join(OUT, 'class-overview-all.json'),
    JSON.stringify(wrapPayload({ spread: true, value: allOverview, endpoint: 'class-overview-all' }))
  );

  let written = 1;
  for (const year of YEARS) {
    const dir = path.join(OUT, String(year));
    fs.mkdirSync(dir, { recursive: true });
    for (const spec of ENDPOINTS) {
      const value = await spec.build(elite, year);
      const payload = wrapPayload({
        spread: spec.spread,
        items: spec.items,
        value,
        endpoint: spec.file,
        year,
      });
      fs.writeFileSync(path.join(dir, `${spec.file}.json`), JSON.stringify(payload));
      written += 1;
    }
  }

  return { ok: true, written, out: OUT };
}

async function rebuildRecruitingSnapshots() {
  const started = Date.now();
  const [page, hub] = await Promise.all([rebuildPageSnapshots(), rebuildHubSnapshots()]);
  const elapsedMs = Date.now() - started;
  console.log('[recruiting-snapshot-rebuild] complete', { elapsedMs, page, hub });
  return { ok: true, elapsedMs, page, hub };
}

module.exports = {
  rebuildPageSnapshots,
  rebuildHubSnapshots,
  rebuildRecruitingSnapshots,
};
