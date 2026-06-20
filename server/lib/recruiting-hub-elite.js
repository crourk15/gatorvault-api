/**
 * Recruiting Hub Elite — payload builders for /api/recruiting/hub/*
 */
const store = require('./recruiting-store');
const { enrichBoard } = require('./recruiting-board-enrich');
const { buildHeatCheck } = require('./heat-check-store');

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH', 'K', 'P'];

function playerPos(player) {
  return player.position || player.pos || '—';
}

function normalizePos(raw) {
  const p = String(raw || '').toUpperCase().trim();
  if (p === 'EDGE' || p === 'DE' || p === 'DT') return 'DL';
  return p || '—';
}

function parseUfPct(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function futureCastTag(pct) {
  if (pct >= 70) return 'Lean UF';
  if (pct >= 34) return 'Battle';
  return 'Lean Elsewhere';
}

function trendDisplay(trend) {
  if (trend === 'up') return 'Rising';
  if (trend === 'down') return 'Falling';
  return 'Stable';
}

function trendFromDelta(delta) {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'stable';
}

function buildSparkline(base, trend) {
  const points = 7;
  const values = [];
  for (let i = 0; i < points; i += 1) {
    const progress = i / (points - 1);
    const drift = trend === 'up' ? progress * 12 : trend === 'down' ? (1 - progress) * 12 : 0;
    values.push(Math.max(0, Math.round(base - 6 + drift + (i % 2 === 0 ? 1 : 0))));
  }
  return values;
}

function blueChipPct(players) {
  if (!players.length) return null;
  const blue = players.filter((p) => (Number(p.stars) || 0) >= 4).length;
  return Math.round((blue / players.length) * 100);
}

function avgRating(players) {
  const ratings = players
    .map((p) => p.rating ?? p.displayRating ?? p.vaultGrade)
    .filter((v) => v != null && Number.isFinite(Number(v)) && Number(v) > 0);
  if (!ratings.length) return null;
  return ratings.reduce((sum, v) => sum + Number(v), 0) / ratings.length;
}

function formatRating(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return '—';
  const n = Number(raw);
  return n <= 1 ? (n * 100).toFixed(2) : n.toFixed(1);
}

function formatRank(rank) {
  if (rank == null || !Number.isFinite(Number(rank))) return '—';
  return `#${rank}`;
}

function formatCommitDate(player) {
  if (!player.commitDate) return 'Recently';
  const d = new Date(player.commitDate);
  if (Number.isNaN(d.getTime())) return String(player.commitDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function commitStatusBadge(player) {
  if (player.headliner) return 'Headliner';
  if ((Number(player.stars) || 0) >= 5) return 'Locked';
  if ((Number(player.stars) || 0) >= 4) return 'Solid';
  return undefined;
}

function rankNote(player) {
  const preview = player.skinny ?? player.notePreview ?? player.notes ?? player.profileNote;
  if (preview && String(preview).trim()) return String(preview).trim();
  const pos = playerPos(player);
  return `NATL ${formatRank(player.natlRank ?? player.natl)} · POS ${formatRank(player.posRank)} (${pos})`;
}

function profileUrl(player) {
  const slug = player.slug || String(player.name || '').toLowerCase().replace(/\s+/g, '-');
  return `/vault/recruiting/player/${encodeURIComponent(slug)}`;
}

async function loadEnrichedBoard(year) {
  const board = await store.getBoard(year);
  return enrichBoard(board, false);
}

async function buildHubTicker(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = enriched.commits || [];
  const targets = enriched.targets || [];
  const rank = enriched.rankings?.nationalRank;
  const chip = blueChipPct([...commits, ...targets]);
  const items = [];

  if (rank) items.push(`${year} class trending nationally — UF at #${rank}`);
  if (chip != null) items.push(`Blue chip % at ${chip}% and climbing`);
  if (commits.length) items.push(`${commits.length} commits locked for ${year}`);
  items.push('Battles heating up on the board — movement intel live');

  try {
    const heat = await buildHeatCheck();
    for (const row of (heat.rising || []).slice(0, 2)) {
      const label = row.headline || row.triggerLabel || `${row.playerName} trending up`;
      items.push(label);
    }
  } catch {
    /* optional heat feed */
  }

  const fallbacks = [
    'Staff locked in for summer evals and camps',
    'FutureCast tracking multiple UF leaners',
    'Portal watch active — movement on the board',
  ];

  return [...items, ...fallbacks].slice(0, 4);
}

async function buildHubClassOverview(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = enriched.commits || [];
  const targets = enriched.targets || [];
  const pool = [...commits, ...targets];
  const chip = blueChipPct(pool);
  const avg = avgRating(pool);

  let rising = 0;
  let falling = 0;
  try {
    const { buildMovementSummaryPayload } = require('../api/recruiting/movement-summary.ts');
    const summary = await buildMovementSummaryPayload();
    rising = summary.rising ?? 0;
    falling = summary.falling ?? 0;
  } catch {
    rising = targets.filter((p) => p.movementDirection === 'up').length;
    falling = targets.filter((p) => p.movementDirection === 'down').length;
  }

  const rankTrend = trendFromDelta(falling - rising);
  const chipTrend = chip != null && chip >= 70 ? 'up' : 'stable';
  const commitTrend = commits.length > 0 ? 'up' : 'stable';
  const ratingTrend = rising >= 2 ? 'up' : rising === 0 && falling > 0 ? 'down' : 'stable';

  return {
    classRank: enriched.rankings?.nationalRank != null ? `#${enriched.rankings.nationalRank}` : '—',
    blueChip: chip != null ? `${chip}%` : '—',
    commits: commits.length ? String(commits.length) : '—',
    avgRating: avg != null ? formatRating(avg) : '—',
    trendRank: trendDisplay(rankTrend),
    trendBlueChip: trendDisplay(chipTrend),
    trendCommits: trendDisplay(commitTrend),
    trendRating: trendDisplay(ratingTrend),
    sparklines: {
      classRank: buildSparkline(enriched.rankings?.nationalRank ?? 10, rankTrend === 'up' ? 'down' : rankTrend),
      blueChip: buildSparkline(chip ?? 60, chipTrend),
      commits: buildSparkline(commits.length || 18, commitTrend),
      avgRating: buildSparkline(Math.round((avg ?? 90) - 80), ratingTrend),
    },
  };
}

function movementLabel(player) {
  if (player.movementDirection === 'up') return 'Trending up';
  if (player.movementDirection === 'down') return 'Trending down';
  return 'Stable';
}

function stabilityMeter(player) {
  const raw = player.stabilityScore ?? player.fitScore ?? parseUfPct(player.ufProbability);
  if (raw >= 80) return 'Locked In';
  if (raw >= 55) return 'Steady';
  if (raw >= 35) return 'Tracking';
  return 'Volatile';
}

function formatNilEstimate(player) {
  const raw = player.nilEstimate ?? player.nilValue ?? player.nilProjection;
  if (raw != null && raw !== '') {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw >= 1000 ? `$${Math.round(raw / 1000)}K` : `$${Math.round(raw)}`;
    }
    return String(raw);
  }
  const stars = Number(player.stars) || 0;
  if (stars >= 5) return '$400K–$750K';
  if (stars >= 4) return '$75K–$250K';
  if (stars >= 3) return '$15K–$75K';
  return null;
}

function formatStrengths(player) {
  const list = player.strengths;
  if (Array.isArray(list) && list.length) return list.slice(0, 2).join(' · ');
  return null;
}

function formatWeaknesses(player) {
  const list = player.weaknesses;
  if (Array.isArray(list) && list.length) return list.slice(0, 2).join(' · ');
  return null;
}

function mapHubCommit(player, classYear) {
  const pct = parseUfPct(player.ufProbability);
  const slug = player.slug || player.name;
  return {
    id: slug,
    name: player.name,
    position: playerPos(player),
    rating: formatRating(player.displayRating ?? player.rating ?? player.vaultGrade),
    rankNote: rankNote(player),
    commitDate: formatCommitDate(player),
    statusBadge: classYear >= 2027 ? commitStatusBadge(player) : 'Enrolled',
    profileUrl: profileUrl(player),
    stabilityMeter: stabilityMeter(player),
    ufPercent: pct > 0 ? `${pct}%` : '—',
    movement: movementLabel(player),
    enrolled: classYear <= 2026,
    jerseyNumber: player.jerseyNumber ?? player.jersey ?? null,
    positionRoomFit: player.schemeFit ?? (player.fitScore != null ? `Fit ${Math.round(Number(player.fitScore))}/100` : null),
    earlyImpactProjection: player.projection ?? player.earlyImpact ?? player.skinny ?? null,
    strengths: formatStrengths(player),
    weaknesses: formatWeaknesses(player),
    playerComp: player.playerComp ?? player.comp ?? null,
    gvGrade: formatRating(player.vaultGrade ?? player.displayRating ?? player.rating),
    nilEstimate: formatNilEstimate(player),
    projection: player.projection ?? player.skinny ?? player.profileNote ?? null,
    insiderIntel: player.notePreview ?? player.notes ?? player.insiderNotes ?? null,
  };
}

async function buildHubCommits(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = [...(enriched.commits || [])].sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    return ra - rb;
  });

  return commits.map((player) => mapHubCommit(player, year));
}

async function buildHubClassOverviewAll() {
  const years = [2026, 2027, 2028];
  const out = {};
  for (const year of years) {
    out[year] = await buildHubClassOverview(year);
  }
  return out;
}

async function buildHubBattles(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const targets = enriched.targets || [];
  const battles = [];

  for (const player of targets) {
    const pct = parseUfPct(player.ufProbability);
    if (pct < 34) continue;
    battles.push({
      id: player.slug || player.name,
      name: player.name,
      position: playerPos(player),
      ufPercent: `${pct}%`,
      tag: futureCastTag(pct),
      note: player.notePreview ?? player.notes ?? player.skinny ?? 'Key battle on the board.',
      movement:
        player.movementDirection === 'up'
          ? 'Trending up'
          : player.movementDirection === 'down'
            ? 'Trending down'
            : pct >= 70
              ? 'Stable'
              : 'Stable',
    });
  }

  battles.sort((a, b) => parseInt(b.ufPercent, 10) - parseInt(a.ufPercent, 10));

  if (battles.length < 4) {
    try {
      const heat = await buildHeatCheck();
      for (const row of heat.rising || []) {
        if (battles.length >= 6) break;
        battles.push({
          id: row.playerSlug || row.playerName,
          name: row.playerName,
          position: '—',
          ufPercent: '—',
          tag: 'Battle',
          note: row.headline ?? row.triggerLabel ?? 'Movement heating up.',
          movement: 'Trending up',
        });
      }
    } catch {
      /* optional */
    }
  }

  return battles.slice(0, 6);
}

async function buildHubPositions(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = enriched.commits || [];
  const targets = enriched.targets || [];
  const rooms = new Map();

  for (const player of commits) {
    const label = normalizePos(playerPos(player));
    const entry = rooms.get(label) ?? { commits: 0, targets: 0 };
    entry.commits += 1;
    rooms.set(label, entry);
  }

  for (const player of targets) {
    if (player.tier !== 'TOP' && player.tier !== 'HIGH') continue;
    const label = normalizePos(playerPos(player));
    const entry = rooms.get(label) ?? { commits: 0, targets: 0 };
    entry.targets += 1;
    rooms.set(label, entry);
  }

  const sorted = [...rooms.entries()].sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a[0]);
    const bi = POSITION_ORDER.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return sorted.slice(0, 8).map(([label, stats]) => ({
    id: label,
    label,
    commits: stats.commits,
    targets: stats.targets,
    note:
      stats.commits >= 2
        ? 'Room filling in'
        : stats.targets >= 2
          ? 'Active battles'
          : stats.commits >= 1
            ? 'Room anchored, selective'
            : 'Needs attention',
  }));
}

function movementArrow(player) {
  const dir = player.movementDirection;
  if (dir === 'up') return 'up';
  if (dir === 'down') return 'down';
  return 'flat';
}

function computeHeatScore(player) {
  const uf = parseUfPct(player.ufProbability);
  const fit = Number(player.fitScore);
  let heat = Math.max(uf, Number.isFinite(fit) ? Math.round(fit) : 0);

  if (player.tier === 'TOP') heat += 12;
  else if (player.tier === 'HIGH') heat += 6;

  const natl = player.natlRank ?? player.natl;
  if (natl != null && Number(natl) <= 100) heat += 12;
  else if (natl != null && Number(natl) <= 300) heat += 6;

  if (player.movementDirection === 'up') heat += 14;
  else if (player.movementDirection === 'down') heat -= 10;

  if (player.headliner) heat += 8;

  return Math.min(100, Math.max(0, Math.round(heat)));
}

function resolveBattle(player) {
  const uf = parseUfPct(player.ufProbability);
  const leader = player.leaderSchool ?? player.predictionLeader ?? player.topSchool ?? null;
  const leaderName =
    typeof leader === 'string'
      ? leader
      : leader?.name || leader?.school || 'Field';
  const isUfLeader = /florida|gators|\buf\b/i.test(String(leaderName));
  const competitor = isUfLeader
    ? Math.max(100 - uf, 8)
    : Math.min(Math.max(100 - uf, 20), 95);
  return {
    uf,
    competitor,
    competitorName: isUfLeader ? 'Field' : String(leaderName).slice(0, 24),
  };
}

function formatNextVisit(player) {
  if (!player.visitStart) return null;
  const d = new Date(player.visitStart);
  if (Number.isNaN(d.getTime())) return String(player.visitStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortInsiderNote(player) {
  const note = player.notePreview ?? player.skinny ?? player.notes;
  if (!note || !String(note).trim()) return null;
  const text = String(note).trim();
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

async function buildHubHeatIndex(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const targets = (enriched.targets || []).filter(
    (p) => p.tier === 'TOP' || p.tier === 'HIGH' || parseUfPct(p.ufProbability) >= 34
  );

  const scored = targets.map((player) => ({
    id: player.slug || player.name,
    name: player.name,
    position: playerPos(player),
    heat: computeHeatScore(player),
    movement: movementArrow(player),
    ufPercent: parseUfPct(player.ufProbability),
    battle: resolveBattle(player),
    nextVisit: formatNextVisit(player),
    insiderNote: shortInsiderNote(player),
    profileUrl: profileUrl(player),
  }));

  scored.sort((a, b) => b.heat - a.heat);

  if (scored.length < 8) {
    try {
      const heat = await buildHeatCheck();
      for (const row of heat.rising || []) {
        if (scored.length >= 12) break;
        if (scored.some((s) => s.id === row.playerSlug || s.name === row.playerName)) continue;
        scored.push({
          id: row.playerSlug || row.playerName,
          name: row.playerName,
          position: row.position || '—',
          heat: Math.min(100, 55 + (row.score || 0)),
          movement: 'up',
          ufPercent: 0,
          battle: { uf: 0, competitor: 50, competitorName: 'Field' },
          nextVisit: null,
          insiderNote: row.headline ?? row.triggerLabel ?? null,
          profileUrl: profileUrl({ slug: row.playerSlug, name: row.playerName }),
        });
      }
    } catch {
      /* optional heat feed */
    }
  }

  return scored.slice(0, 12);
}

async function buildHubMovementFeed(_year = 2027) {
  const { buildHubMovementFeed: buildCuratedFeed } = require('./recruiting-hub-intel-store');
  return buildCuratedFeed();
}

async function buildHubBattleBoard(_year = 2027) {
  const { buildHubBattleBoard: buildBoard } = require('./recruiting-hub-intel-store');
  return buildBoard();
}

async function buildHubFootprint(_year = 2027) {
  const { buildHubFootprint: buildFootprint } = require('./recruiting-hub-intel-store');
  return buildFootprint();
}

module.exports = {
  buildHubTicker,
  buildHubClassOverview,
  buildHubClassOverviewAll,
  buildHubCommits,
  buildHubBattles,
  buildHubPositions,
  buildHubHeatIndex,
  buildHubMovementFeed,
  buildHubBattleBoard,
  buildHubFootprint,
};
