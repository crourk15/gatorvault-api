/**
 * NIL Elite bundle — proven board / roster / collective signals only.
 * Never invents deal dollars. On3 NIL shown only when store has a real value.
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

function formatNilEstimate(player) {
  const raw = player?.nilEstimate ?? player?.nilValue ?? player?.nilProjection;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw >= 1000 ? `$${Math.round(raw / 1000)}K` : `$${Math.round(raw)}`;
  }
  const s = String(raw).trim();
  if (!s || s === '0' || /^\$?0k?$/i.test(s)) return null;
  return s.startsWith('$') ? s : `$${s}`;
}

function boardWeight(p) {
  /** Sort key only — never displayed as money. */
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
    delta7d: p.delta7d != null ? Number(p.delta7d) : p.movementDelta != null ? Number(p.movementDelta) : null,
    committedTo: committedTo ? String(committedTo) : null,
    status,
    nilEstimate: formatNilEstimate(p),
    headliner: Boolean(p.headliner),
    ...extras,
  };
}

function loadRosterTransfers() {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/roster/players.json'), 'utf8')
    );
    const arr = Array.isArray(raw) ? raw : raw.items || raw.players || Object.values(raw);
    return (arr || [])
      .filter((p) => p && String(p.transferInfo || '').trim())
      .map((p) => ({
        id: String(p.id || p.slug || p.name),
        slug: p.slug || null,
        name: p.name || p.fullName || 'Player',
        position: p.position || p.pos || 'ATH',
        transferInfo: String(p.transferInfo).trim(),
        stars: effectiveStars(p),
        nationalRank: effectiveRank(p),
      }))
      .slice(0, 12);
  } catch {
    return [];
  }
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

function buildEditorialLandscape() {
  const dash = nilStore.buildDashboard({ conference: 'SEC' });
  const asOf = dash.manifest?.updatedAt || dash.updatedAt || null;
  return {
    asOf,
    disclaimer:
      'Editorial landscape estimates from curated public signals — not audited deal ledgers. Demoted below live board data.',
    uf: dash.ufStanding
      ? {
          collective: dash.ufStanding.collective || 'Florida Victorious',
          secRank: dash.ufStanding.secRank ?? null,
          nationalRank: dash.ufStanding.nationalRank ?? null,
          estimatedAnnualPoolM: dash.ufStanding.estimatedAnnualPoolM ?? null,
        }
      : null,
    sec: (dash.secRankings || []).slice(0, 16).map((row) => ({
      id: row.id,
      school: row.school || row.name,
      collective: row.collective || null,
      secRank: row.ranking?.secRank ?? null,
      estimatedAnnualPoolM: row.metrics?.estimatedAnnualPoolM ?? null,
    })),
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

  // Board heat: open targets with confirmed UF % or headliner status, else top fit by board weight.
  const heated = targets.filter(
    (p) => (p.ufRpmPct != null && Number(p.ufRpmPct) > 0) || p.headliner || (p.competitors || []).length
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
      text: `${p.name} (${p.position}${p.stars ? ` · ${p.stars}★` : ''}${p.nationalRank ? ` · #${p.nationalRank}` : ''}) is on the UF board as a commit.`,
      slug: p.slug,
    });
  }
  for (const p of elsewhere.slice(0, 4)) {
    const row = mapBoardPlayer(p);
    movementFeed.push({
      id: `else-${row.slug}`,
      category: 'Elsewhere',
      text: `${row.name} committed to ${row.committedTo}.`,
      slug: row.slug,
    });
  }
  for (const p of movers.slice(0, 4)) {
    if (p.ufRpmPct == null) continue;
    movementFeed.push({
      id: `rpm-${p.slug}`,
      category: 'Board',
      text: `${p.name} sits at ${p.ufRpmPct}% UF on the prediction market board.`,
      slug: p.slug,
    });
  }

  const portalResult = await loadPortalPressure(12);
  const portalPlayers = Array.isArray(portalResult) ? portalResult : portalResult.players || [];
  const portalError = Array.isArray(portalResult) ? null : portalResult.error || null;
  const rosterTransfers = loadRosterTransfers();

  const chip = blueChipPct(commits);
  const rating = avgRating(commits);
  const ufProgram = nilStore.loadPrograms().find((p) => p.id === nilStore.UF_ID);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    classYear,
    hero: {
      collective: ufProgram?.collective || 'Florida Victorious',
      school: ufProgram?.school || 'Florida Gators',
      eyebrow: 'GatorVault NIL',
      title: 'NIL Tracker',
      sub: 'Live board, portal, and collective signals — proven data only. No invented deal dollars.',
    },
    pulse: {
      commits: commits.length,
      blueChipPct: chip,
      avgRating: rating,
      activeTargets: targets.length,
      portalArrivals: rosterTransfers.length,
      portalWatch: portalPlayers.length,
    },
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
    editorial: buildEditorialLandscape(),
  };
}

module.exports = {
  buildNilEliteBundle,
  formatNilEstimate,
  CLASS_YEAR,
};
