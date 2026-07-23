/**
 * NIL Elite bundle — money-first tracker with labeled sources.
 * - Program pool / deal metrics: curated public reporting (nil_metrics)
 * - Roster NIL: Vault model estimates from roster enrichment
 * - Board NIL: On3 when present; otherwise Vault recruiting-band estimate
 * Never labels a model estimate as On3.
 */
const path = require('path');
const fs = require('fs');
const nilStore = require('./nil-store');
const store = require('./recruiting-store');
const {
  isActiveUfTarget,
  isCommittedElsewhere,
  isFloridaSchool,
} = require('./recruiting-target-filters');

const CLASS_YEAR = 2027;

function effectiveStars(p) {
  const n = Number(p?.stars);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function effectiveRank(p) {
  const n = Number(p?.natlRank ?? p?.nationalRank ?? p?.rank);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatUsdCompact(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`;
  }
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

/** Public / On3-style fields only — never invent. */
function formatOn3Nil(player) {
  const raw = player?.nilEstimate ?? player?.nilValue ?? player?.nilProjection;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return formatUsdCompact(raw);
  }
  const s = String(raw).trim();
  if (!s || s === '0' || /^\$?0k?$/i.test(s)) return null;
  return s.startsWith('$') ? s : `$${s}`;
}

/**
 * Recruiting-band Vault estimate (same band logic as legacy NIL tracker cards).
 * Returns dollars.
 */
function vaultBoardEstimateDollars(p) {
  const stars = effectiveStars(p) ?? 4;
  const rank = effectiveRank(p) ?? 200;
  const baseK = Math.max(35, 220 - rank / 2) * (stars >= 5 ? 1.4 : stars >= 4 ? 1 : 0.7);
  return Math.round(baseK) * 1000;
}

function boardWeight(p) {
  const stars = effectiveStars(p) || 3;
  const rank = effectiveRank(p) || 500;
  return stars * 1000 - rank;
}

function mapBoardPlayer(p, extras = {}) {
  const slug = String(p.slug || p.id || '').trim();
  const committedTo = p.committedTo ?? p.committed_to ?? null;
  let status = 'board';
  if (committedTo && isFloridaSchool(committedTo)) status = 'uf_commit';
  else if (isCommittedElsewhere(p)) status = 'elsewhere';
  else if (isActiveUfTarget(p)) status = 'uf_target';

  const on3 = formatOn3Nil(p);
  const vaultDollars = vaultBoardEstimateDollars(p);
  const vaultEst = formatUsdCompact(vaultDollars);

  return {
    id: slug,
    slug,
    name: p.name || slug,
    position: p.pos || p.position || 'ATH',
    classYear: Number(p.classYear) || CLASS_YEAR,
    school: p.school || null,
    stars: effectiveStars(p),
    nationalRank: effectiveRank(p),
    rating: p.rating != null ? Number(p.rating) : null,
    ufRpmPct: p.ufRpmPct != null ? Number(p.ufRpmPct) : null,
    delta7d:
      p.delta7d != null
        ? Number(p.delta7d)
        : p.movementDelta != null
          ? Number(p.movementDelta)
          : null,
    committedTo: committedTo ? String(committedTo) : null,
    status,
    nilEstimate: on3,
    vaultEstimate: on3 ? null : vaultEst,
    nilSource: on3 ? 'on3' : vaultEst ? 'vault_est' : null,
    nilDisplay: on3 || vaultEst,
    headliner: Boolean(p.headliner),
    ...extras,
  };
}

function loadRosterPlayers() {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/roster/players.json'), 'utf8')
    );
    const arr = Array.isArray(raw) ? raw : raw.items || raw.players || Object.values(raw);
    return (arr || []).filter(Boolean);
  } catch {
    return [];
  }
}

function loadRosterTransfers() {
  return loadRosterPlayers()
    .filter((p) => String(p.transferInfo || '').trim())
    .map((p) => ({
      id: String(p.id || p.slug || p.name),
      slug: p.slug || null,
      name: p.name || p.fullName || 'Player',
      position: p.position || p.pos || 'ATH',
      transferInfo: String(p.transferInfo).trim(),
      stars: effectiveStars(p),
      nationalRank: effectiveRank(p),
      nilValuation: formatUsdCompact(Number(p.nilValuation)),
    }))
    .slice(0, 12);
}

function buildRosterEarners(limit = 16) {
  return loadRosterPlayers()
    .map((p) => {
      const dollars = Number(p.nilValuation);
      if (!Number.isFinite(dollars) || dollars <= 0) return null;
      return {
        id: String(p.id || p.slug || p.name),
        slug: p.slug || null,
        name: p.name || p.fullName || 'Player',
        position: p.position || p.pos || 'ATH',
        classYear: p.classYear != null ? Number(p.classYear) : null,
        stars: effectiveStars(p),
        depthChartTier: p.depthChartTier || null,
        nilValuation: formatUsdCompact(dollars),
        nilValuationRaw: dollars,
        nilSource: 'vault_est',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.nilValuationRaw - a.nilValuationRaw)
    .slice(0, limit)
    .map(({ nilValuationRaw, ...rest }) => rest);
}

async function loadPortalPressure(limit = 12) {
  try {
    require('tsx/cjs');
    const { listPortalCandidates, portalRowToEngineInput } = require('../models/portal-intel.ts');
    const {
      computePortalLikelihood,
      computeDepthChartRisk,
      computeVolatility,
    } = require('../api/portal/engine.ts');

    const rows = await listPortalCandidates({ limit: Math.max(limit * 4, 40) });
    return rows
      .filter((row) => {
        if (row.uf_status && String(row.uf_status).toUpperCase() !== 'NONE') return true;
        return (row.uf_fit_score ?? 0) > 0;
      })
      .map((row) => {
        const input = portalRowToEngineInput(row);
        return {
          id: row.id,
          slug: row.slug || null,
          name: row.full_name,
          position: row.position,
          classYear: row.class_year,
          portalLikelihood: Math.round(computePortalLikelihood(input) * 1000) / 10,
          depthChartRisk: Math.round(computeDepthChartRisk(input) * 10) / 10,
          volatility: Math.round(computeVolatility(input) * 10) / 10,
        };
      })
      .sort((a, b) => b.portalLikelihood - a.portalLikelihood)
      .slice(0, limit);
  } catch (err) {
    return { error: err.message || String(err), players: [] };
  }
}

function blueChipPct(players) {
  if (!players.length) return null;
  const chip = players.filter((p) => (effectiveStars(p) || 0) >= 4).length;
  return Math.round((chip / players.length) * 100);
}

function avgRating(players) {
  const vals = players.map((p) => Number(p.rating)).filter((n) => Number.isFinite(n) && n > 0);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function buildCollectiveDirectory() {
  return nilStore
    .loadPrograms()
    .filter((p) => p.conference === 'SEC')
    .map((p) => ({
      id: p.id,
      school: p.school,
      collective: p.collective || null,
      isUf: p.id === nilStore.UF_ID,
    }))
    .sort((a, b) => String(a.school).localeCompare(String(b.school)));
}

function buildMoneyLandscape() {
  const dash = nilStore.buildDashboard({ conference: 'SEC' });
  const metricsFile = (() => {
    try {
      return JSON.parse(
        fs.readFileSync(path.join(__dirname, '../data/nil/nil_metrics.json'), 'utf8')
      );
    } catch {
      return {};
    }
  })();
  const metricsNote =
    metricsFile.sourceNote ||
    dash.manifest?.disclaimer ||
    'Estimated annual pools from public reporting — updated quarterly';
  const ufMetrics = dash.primary?.metrics || null;
  const asOf = dash.manifest?.updatedAt || dash.updatedAt || null;

  const uf = dash.ufStanding
    ? {
        collective: dash.ufStanding.collective || 'Florida Victorious',
        secRank: dash.ufStanding.secRank ?? null,
        nationalRank: dash.ufStanding.nationalRank ?? null,
        estimatedAnnualPoolM: dash.ufStanding.estimatedAnnualPoolM ?? null,
        avgDealK: ufMetrics?.avgDealK ?? null,
        topDealM: ufMetrics?.topDealM ?? null,
        trend: dash.ufStanding.trend ?? ufMetrics?.trend ?? null,
        trendPct: dash.ufStanding.trendPct ?? ufMetrics?.trendPct ?? null,
      }
    : null;

  const sec = (dash.secRankings || []).slice(0, 16).map((row) => ({
    id: row.id,
    school: row.school || row.name,
    collective: row.collective || null,
    secRank: row.ranking?.secRank ?? null,
    nationalRank: row.ranking?.nationalRank ?? null,
    score: row.ranking?.score ?? null,
    estimatedAnnualPoolM: row.metrics?.estimatedAnnualPoolM ?? null,
    avgDealK: row.metrics?.avgDealK ?? null,
    topDealM: row.metrics?.topDealM ?? null,
    trend: row.metrics?.trend ?? null,
    trendPct: row.metrics?.trendPct ?? null,
  }));

  return {
    asOf,
    sourceNote: metricsNote,
    disclaimer:
      'Program pool and deal figures are curated public estimates — not audited player contracts. Roster / board player dollars use the Vault model unless On3 is public.',
    uf,
    sec,
  };
}

async function buildNilEliteBundle(options = {}) {
  const classYear = Number(options.classYear) || CLASS_YEAR;
  const all = await store.getAllPlayers();
  const yearPlayers = all.filter((p) => Number(p.classYear) === classYear);
  const commits = await store.getHubHsCommits(classYear);
  const targets = yearPlayers.filter((p) => isActiveUfTarget(p));
  const elsewhere = yearPlayers.filter((p) => isCommittedElsewhere(p));

  const boardLeaders = [...yearPlayers]
    .filter((p) => effectiveStars(p) || effectiveRank(p))
    .sort((a, b) => boardWeight(b) - boardWeight(a))
    .slice(0, 16)
    .map((p) => mapBoardPlayer(p));

  const ufTargets = [...targets]
    .sort((a, b) => {
      const rpm = (Number(b.ufRpmPct) || 0) - (Number(a.ufRpmPct) || 0);
      if (rpm !== 0) return rpm;
      return boardWeight(b) - boardWeight(a);
    })
    .slice(0, 16)
    .map((p) => mapBoardPlayer(p));

  const ufCommits = commits
    .slice()
    .sort((a, b) => boardWeight(b) - boardWeight(a))
    .slice(0, 24)
    .map((p) => mapBoardPlayer(p, { status: 'uf_commit' }));

  const heated = targets.filter(
    (p) =>
      (p.ufRpmPct != null && Number(p.ufRpmPct) > 0) || p.headliner || (p.competitors || []).length
  );
  const movers = (heated.length ? heated : targets)
    .slice()
    .sort(
      (a, b) =>
        (Number(b.ufRpmPct) || 0) - (Number(a.ufRpmPct) || 0) || boardWeight(b) - boardWeight(a)
    )
    .slice(0, 16)
    .map((p) => mapBoardPlayer(p));

  const movementFeed = [];
  for (const p of ufCommits.slice(0, 6)) {
    movementFeed.push({
      id: `commit-${p.slug}`,
      category: 'Commit',
      text: `${p.name} (${p.position}${p.stars ? ` · ${p.stars}★` : ''}${
        p.nilDisplay ? ` · ${p.nilDisplay}` : ''
      }) is on the UF board as a commit.`,
      slug: p.slug,
    });
  }
  for (const p of elsewhere.slice(0, 4)) {
    const row = mapBoardPlayer(p);
    movementFeed.push({
      id: `else-${row.slug}`,
      category: 'Elsewhere',
      text: `${row.name} committed to ${row.committedTo}${
        row.nilDisplay ? ` · ${row.nilDisplay} est.` : ''
      }.`,
      slug: row.slug,
    });
  }
  for (const p of movers.slice(0, 4)) {
    if (p.ufRpmPct == null) continue;
    movementFeed.push({
      id: `rpm-${p.slug}`,
      category: 'Board',
      text: `${p.name} sits at ${p.ufRpmPct}% UF${
        p.nilDisplay ? ` · ${p.nilDisplay}` : ''
      } on the prediction market board.`,
      slug: p.slug,
    });
  }

  const portalResult = await loadPortalPressure(12);
  const portalPlayers = Array.isArray(portalResult) ? portalResult : portalResult.players || [];
  const portalError = Array.isArray(portalResult) ? null : portalResult.error || null;
  const rosterTransfers = loadRosterTransfers();
  const rosterEarners = buildRosterEarners(16);
  const landscape = buildMoneyLandscape();

  const chip = blueChipPct(commits);
  const rating = avgRating(commits);
  const ufProgram = nilStore.loadPrograms().find((p) => p.id === nilStore.UF_ID);
  const poolM = landscape.uf?.estimatedAnnualPoolM ?? null;
  const poolLabel = poolM != null ? `~$${poolM}M` : null;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    classYear,
    hero: {
      collective: ufProgram?.collective || landscape.uf?.collective || 'Florida Victorious',
      school: ufProgram?.school || 'Florida Gators',
      eyebrow: 'GatorVault NIL',
      title: 'NIL Tracker',
      sub: 'UF pool estimates, roster valuations, and SEC market position — labeled sources, real dollars front and center.',
      poolLabel,
      poolCaption: 'UF annual pool est.',
    },
    money: {
      estimatedAnnualPoolM: poolM,
      poolLabel,
      avgDealK: landscape.uf?.avgDealK ?? null,
      topDealM: landscape.uf?.topDealM ?? null,
      secRank: landscape.uf?.secRank ?? null,
      nationalRank: landscape.uf?.nationalRank ?? null,
      trend: landscape.uf?.trend ?? null,
      trendPct: landscape.uf?.trendPct ?? null,
      collective: landscape.uf?.collective || ufProgram?.collective || 'Florida Victorious',
      sourceNote: landscape.sourceNote,
    },
    pulse: {
      commits: commits.length,
      blueChipPct: chip,
      avgRating: rating,
      activeTargets: targets.length,
      portalArrivals: rosterTransfers.length,
      portalWatch: portalPlayers.length,
    },
    rosterEarners,
    marketBoard: {
      leaders: boardLeaders,
      targets: ufTargets,
      movers,
      commits: ufCommits,
    },
    portal: {
      watchlist: portalPlayers,
      watchlistError: portalError,
      rosterArrivals: rosterTransfers,
    },
    collectives: buildCollectiveDirectory(),
    movement: movementFeed.slice(0, 10),
    /** Primary money landscape (always shown). */
    landscape,
    /** Backward-compatible alias for older clients / home pulse. */
    editorial: {
      asOf: landscape.asOf,
      disclaimer: landscape.disclaimer,
      uf: landscape.uf
        ? {
            collective: landscape.uf.collective,
            secRank: landscape.uf.secRank,
            nationalRank: landscape.uf.nationalRank,
            estimatedAnnualPoolM: landscape.uf.estimatedAnnualPoolM,
          }
        : null,
      sec: landscape.sec.map((row) => ({
        id: row.id,
        school: row.school,
        collective: row.collective,
        secRank: row.secRank,
        estimatedAnnualPoolM: row.estimatedAnnualPoolM,
      })),
    },
  };
}

module.exports = {
  buildNilEliteBundle,
  formatNilEstimate: formatOn3Nil,
  formatOn3Nil,
  formatUsdCompact,
  vaultBoardEstimateDollars,
  CLASS_YEAR,
};
