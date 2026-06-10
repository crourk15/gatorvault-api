/**
 * NIL tracking store — SEC programs, metrics, rankings, events.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'nil');
const UF_ID = 'uf';

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}

function loadPrograms() {
  return readJson('nil_programs.json', { items: [] }).items || [];
}

function loadMetrics() {
  return readJson('nil_metrics.json', { items: [] }).items || [];
}

function loadRankings() {
  return readJson('nil_rankings.json', { items: [] }).items || [];
}

function loadEvents() {
  return readJson('nil_events.json', { items: [] }).items || [];
}

function loadManifest() {
  return readJson('manifest.json', { version: 1 });
}

function indexByProgramId(rows) {
  const map = {};
  for (const row of rows || []) {
    if (row.programId) map[row.programId] = row;
  }
  return map;
}

function buildProgramRow(program, metrics, ranking, metricRow) {
  return {
    ...program,
    metrics: metricRow || null,
    ranking: ranking || null
  };
}

function buildDashboard({ conference = 'SEC', programId = UF_ID } = {}) {
  const programs = loadPrograms().filter((p) => !conference || p.conference === conference);
  const metricsById = indexByProgramId(loadMetrics());
  const rankingsById = indexByProgramId(loadRankings());
  const events = loadEvents();

  const rows = programs
    .map((p) => {
      const metricRow = metricsById[p.id] || null;
      const ranking = rankingsById[p.id] || null;
      return buildProgramRow(p, metricsById, ranking, metricRow);
    })
    .sort((a, b) => (a.ranking?.secRank || 99) - (b.ranking?.secRank || 99));

  const uf = rows.find((r) => r.id === programId) || rows.find((r) => r.id === UF_ID);
  const ufEvents = events.filter((e) => e.programId === (uf?.id || UF_ID)).slice(0, 12);
  const peerSlice = rows.filter((r) => r.id !== (uf?.id || UF_ID)).slice(0, 5);

  const positionImpact = {};
  for (const evt of ufEvents) {
    const groups = String(evt.impact || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const g of groups) {
      positionImpact[g] = (positionImpact[g] || 0) + 1;
    }
  }

  const recruitingWins = ufEvents.filter((e) => e.recruitingCorrelation === 'positive').length;

  return {
    manifest: loadManifest(),
    conference,
    primary: uf,
    secRankings: rows,
    ufStanding: uf
      ? {
          secRank: uf.ranking?.secRank,
          nationalRank: uf.ranking?.nationalRank,
          score: uf.ranking?.score,
          estimatedAnnualPoolM: uf.metrics?.estimatedAnnualPoolM,
          trend: uf.metrics?.trend,
          trendPct: uf.metrics?.trendPct,
          collective: uf.collective
        }
      : null,
    trendHistory: buildTrendHistory(uf?.id || UF_ID),
    positionImpact: Object.entries(positionImpact)
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count),
    recruitingCorrelation: {
      positiveEvents: recruitingWins,
      totalEvents: ufEvents.length,
      note: 'Major NIL events correlated with reported recruiting momentum'
    },
    recentEvents: ufEvents,
    peers: peerSlice,
    updatedAt: loadManifest().updatedAt
  };
}

function buildTrendHistory(programId) {
  const metrics = indexByProgramId(loadMetrics())[programId];
  if (!metrics) return [];
  const base = metrics.estimatedAnnualPoolM || 0;
  const pct = metrics.trendPct || 0;
  return [
    { period: '2024', valueM: Math.round((base / (1 + pct / 100)) * 0.82 * 10) / 10 },
    { period: '2025', valueM: Math.round((base / (1 + pct / 100)) * 0.92 * 10) / 10 },
    { period: '2026', valueM: base, trend: metrics.trend, trendPct: pct }
  ];
}

function listSecRankings() {
  return buildDashboard().secRankings;
}

module.exports = {
  UF_ID,
  loadManifest,
  loadPrograms,
  loadMetrics,
  loadRankings,
  loadEvents,
  buildDashboard,
  listSecRankings
};
