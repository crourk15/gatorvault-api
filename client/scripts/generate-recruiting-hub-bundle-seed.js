#!/usr/bin/env node
/**
 * Bake a slim Recruiting Hub bundle seed so /vault/recruiting/ never waits on
 * a cold Render hub build for first paint below the hero.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/recruiting-hub-bundle-seed.json');
const ACTIVE_YEAR = 2027;
const YEARS = [2026, 2027, 2028];

function slimCommit(c) {
  if (!c || !c.name) return null;
  return {
    id: c.id,
    name: c.name,
    position: c.position || 'ATH',
    rating: c.rating || '',
    rankNote: c.rankNote || '',
    metaLine: c.metaLine || undefined,
    skinny: c.skinny || null,
    commitDate: c.commitDate || '',
    statusBadge: c.statusBadge || undefined,
    profileUrl: c.profileUrl || '',
    ufPercent: c.ufPercent ?? null,
    movement: c.movement ?? null,
    stars: c.stars ?? null,
    enrolled: c.enrolled,
    inState: c.inState,
  };
}

function slimBattle(b) {
  if (!b || !b.name) return null;
  return {
    id: b.id,
    name: b.name,
    position: b.position || 'ATH',
    ufPercent: b.ufPercent || '—',
    tag: b.tag || '',
    note: b.note || '',
    movement: b.movement || 'flat',
  };
}

function slimHeat(h) {
  if (!h || !h.name) return null;
  return {
    id: h.id,
    name: h.name,
    position: h.position || 'ATH',
    heat: h.heat ?? 0,
    movement: h.movement || 'flat',
    ufPercent: h.ufPercent ?? null,
    battle: h.battle || { uf: null, competitor: null, competitorName: null },
    nextVisit: h.nextVisit ?? null,
    insiderNote: h.insiderNote ?? null,
    profileUrl: h.profileUrl || '',
  };
}

function slimMovement(m) {
  if (!m || !m.name) return null;
  return {
    id: m.id,
    timestamp: m.timestamp || new Date().toISOString(),
    name: m.name,
    position: m.position || 'ATH',
    class: m.class || ACTIVE_YEAR,
    event: m.event || 'intel',
    summary: String(m.summary || '').slice(0, 220),
    profileUrl: m.profileUrl || '',
    movementNarrative: m.movementNarrative || undefined,
  };
}

function slimBattleBoard(b) {
  if (!b || !b.name) return null;
  return {
    id: b.id,
    name: b.name,
    position: b.position || 'ATH',
    class: b.class || ACTIVE_YEAR,
    battleDifficulty: b.battleDifficulty || 'unknown',
    battleColor: b.battleColor ?? null,
    trend: b.trend || 'flat',
    competitors: Array.isArray(b.competitors)
      ? b.competitors.slice(0, 3).map((c) => ({
          school: c.school,
          logo: c.logo || '',
          score: c.score ?? null,
          trend: c.trend || 'flat',
        }))
      : [],
    ufScore: b.ufScore ?? null,
    nextVisit: b.nextVisit ?? null,
    intel: b.intel ? String(b.intel).slice(0, 180) : null,
  };
}

function slimFootprint(fp) {
  if (!fp || typeof fp !== 'object') return { states: [], pins: [] };
  const states = (fp.states || []).slice(0, 12).map((s) => ({
    state: s.state,
    targets: s.targets || 0,
    commits: s.commits || 0,
    offers: s.offers || 0,
    visits: s.visits || 0,
    ufScore: s.ufScore ?? null,
    pipelineScore: s.pipelineScore || 0,
    momentum: s.momentum || 'flat',
    competitorPressure: s.competitorPressure,
    topPlayers: (s.topPlayers || []).slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position || 'ATH',
      class: p.class || ACTIVE_YEAR,
      status: p.status || 'target',
      ufScore: p.ufScore ?? null,
      competitorScore: p.competitorScore ?? null,
    })),
    staffActivity: (s.staffActivity || []).slice(0, 2),
  }));
  const pins = (fp.pins || []).slice(0, 40).map((p) => ({
    id: p.id,
    name: p.name,
    state: p.state,
    lat: p.lat,
    lng: p.lng,
    status: p.status || 'target',
    ufScore: p.ufScore ?? null,
    pinType: p.pinType || 'target',
  }));
  return { ok: true, states, pins };
}

function cleanSparklines(overview) {
  if (!overview || typeof overview !== 'object') return overview || {};
  const out = { ...overview };
  if (out.sparklines && typeof out.sparklines === 'object') {
    const sparks = {};
    for (const [k, v] of Object.entries(out.sparklines)) {
      sparks[k] = Array.isArray(v) ? v.filter((n) => typeof n === 'number') : [];
    }
    out.sparklines = sparks;
  }
  return out;
}

function slimBundle(raw, year) {
  const classOverview = cleanSparklines(raw.classOverview || {});
  const classOverviewAll = {};
  for (const [k, v] of Object.entries(raw.classOverviewAll || {})) {
    classOverviewAll[k] = cleanSparklines(v);
  }
  return {
    year,
    ticker: Array.isArray(raw.ticker) ? raw.ticker.slice(0, 12) : [],
    classOverview,
    classOverviewAll,
    commits: (raw.commits || []).map(slimCommit).filter(Boolean).slice(0, 24),
    battles: (raw.battles || []).map(slimBattle).filter(Boolean).slice(0, 12),
    positions: (raw.positions || []).slice(0, 16).map((pos) => ({
      id: pos.id,
      label: pos.label || 'Room',
      commits: pos.commits || 0,
      targets: pos.targets || 0,
      note: pos.note || '',
    })),
    heatIndex: (raw.heatIndex || []).map(slimHeat).filter(Boolean).slice(0, 16),
    movementFeed: (raw.movementFeed || []).map(slimMovement).filter(Boolean).slice(0, 20),
    battleBoard: (raw.battleBoard || []).map(slimBattleBoard).filter(Boolean).slice(0, 16),
    footprint: slimFootprint(raw.footprint),
  };
}

function bundleHasSignal(bundle) {
  if (!bundle) return false;
  return (
    (bundle.commits && bundle.commits.length > 0) ||
    (bundle.battles && bundle.battles.length > 0) ||
    (bundle.heatIndex && bundle.heatIndex.length > 0) ||
    (bundle.movementFeed && bundle.movementFeed.length > 0) ||
    (bundle.battleBoard && bundle.battleBoard.length > 0)
  );
}

async function main() {
  const elite = require(path.join(ROOT, 'server/lib/recruiting-hub-elite'));
  const byYear = {};

  for (const year of YEARS) {
    const raw = await elite.buildHubBundle(year);
    byYear[String(year)] = slimBundle(raw, year);
  }

  const active = byYear[String(ACTIVE_YEAR)];
  if (!bundleHasSignal(active)) {
    console.error('[generate-recruiting-hub-bundle-seed] FAIL — active year bundle empty');
    process.exit(1);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    activeYear: ACTIVE_YEAR,
    byYear,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
  console.log(
    '[generate-recruiting-hub-bundle-seed] OK —',
    ACTIVE_YEAR,
    'commits',
    active.commits.length,
    'battles',
    active.battles.length,
    'heat',
    active.heatIndex.length,
    'movement',
    active.movementFeed.length,
    'board',
    active.battleBoard.length
  );
}

main().catch((err) => {
  console.error('[generate-recruiting-hub-bundle-seed] fatal:', err);
  process.exit(1);
});
