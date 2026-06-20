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

async function buildHubCommits(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = [...(enriched.commits || [])].sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    return ra - rb;
  });

  return commits.slice(0, 9).map((player) => ({
    id: player.slug || player.name,
    name: player.name,
    position: playerPos(player),
    rating: formatRating(player.displayRating ?? player.rating ?? player.vaultGrade),
    rankNote: rankNote(player),
    commitDate: formatCommitDate(player),
    statusBadge: commitStatusBadge(player),
    profileUrl: profileUrl(player),
  }));
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

module.exports = {
  buildHubTicker,
  buildHubClassOverview,
  buildHubCommits,
  buildHubBattles,
  buildHubPositions,
};
