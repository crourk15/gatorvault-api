#!/usr/bin/env node
/**
 * Build static recruiting hub JSON snapshots for Netlify CDN (instant load when Render is cold).
 * Output: server/hub-snapshot/
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'hub-snapshot');
const YEARS = [2026, 2027, 2028];

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
  const base = {
    generatedAt: new Date().toISOString(),
    snapshot: true,
    endpoint,
    year: year ?? null,
    source: 'build-hub-snapshot',
  };
  if (endpoint === 'commits') {
    try {
      const { COMMITS_CACHE_REV } = require('../lib/recruiting-hub-cache');
      base.cacheRev = COMMITS_CACHE_REV;
    } catch {
      base.cacheRev = 'c5';
    }
  }
  if (endpoint === 'footprint') {
    try {
      const { FOOTPRINT_CACHE_REV } = require('../lib/recruiting-hub-cache');
      base.cacheRev = FOOTPRINT_CACHE_REV;
    } catch {
      base.cacheRev = 'fp3';
    }
  }
  return base;
}

function wrapPayload({ spread, items, value, endpoint, year }) {
  const base = { ok: true, status: 'ready', meta: meta(endpoint, year) };
  if (spread) {
    const rest = value && typeof value === 'object' ? { ...value } : {};
    const valueMeta = rest.meta && typeof rest.meta === 'object' ? rest.meta : {};
    delete rest.meta;
    // Keep builder meta fields but never let them drop cacheRev / snapshot bookkeeping.
    return { ...base, ...rest, meta: { ...valueMeta, ...base.meta } };
  }
  if (items) return { ...base, items: value };
  return { ...base, ...value };
}

async function main() {
  process.chdir(ROOT);
  const elite = require('../lib/recruiting-hub-elite');

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

  console.log('[build-hub-snapshot] wrote', written, 'files to', OUT);
}

main().catch((err) => {
  console.error('[build-hub-snapshot] failed:', err.message);
  process.exit(1);
});
