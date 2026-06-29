/**
 * Recruiting Hub Elite — payload builders for /api/recruiting/hub/*
 */
const store = require('./recruiting-store');
const { enrichBoard } = require('./recruiting-board-enrich');
const { effectiveStars } = require('./recruiting-target-filters');

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

function blueChipPct(players) {
  if (!players.length) return null;
  const blue = players.filter((p) => (effectiveStars(p) || 0) >= 4).length;
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
  const stars = effectiveStars(player) || 0;
  if (stars >= 5) return 'Locked';
  if (stars >= 4) return 'Solid';
  return undefined;
}

const {
  isGenericBeatArticle,
  firstVerifiedIntel,
  verifiedStrengthsList,
} = require('./recruiting-intel-quality');

const RANK_LINE_SEP = ' | ';

function fallbackCommitBlurb(player) {
  const pos = playerPos(player);
  const stars = effectiveStars(player) || 0;
  const parts = [];
  if (stars) parts.push(`${stars}-star ${pos}`);
  const natl = player.natlRank ?? player.natl;
  if (natl != null) parts.push(`#${natl} natl`);
  const state = player.stateRank;
  if (state != null) parts.push(`#${state} in state`);
  if (player.school) parts.push(String(player.school).trim());
  if (parts.length) return parts.join(RANK_LINE_SEP);
  return `NATL ${formatRank(natl)}${RANK_LINE_SEP}POS ${formatRank(player.posRank)} (${pos})`;
}

function distinctIntel(primary, playerName, ...candidates) {
  const base = primary ? String(primary).trim() : '';
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (!s || s === base || isGenericBeatArticle(s, playerName)) continue;
    return s;
  }
  return null;
}

function isRankLineBlurb(text, playerName) {
  const s = String(text || '').trim();
  if (!s || s.length > 140) return false;
  return !isGenericBeatArticle(s, playerName);
}

function rankNote(player) {
  const skinny = player.skinny ? String(player.skinny).trim() : '';
  if (skinny && isRankLineBlurb(skinny, player.name)) return skinny;
  return fallbackCommitBlurb(player);
}

/** Program trajectory (years 2–4) — staff projection only, never beat-article skinny. */
function verifiedProjection(player) {
  const fromFields = firstVerifiedIntel(
    player,
    ['projection', 'earlyImpact', 'earlyImpactProjection'],
    player.name
  );
  if (fromFields) return fromFields;
  const note = String(player.profileNote || '').trim();
  if (!note) return null;
  const match = note.match(/\b(?:He|She|They)\s+projects?\s+as[^.]+\./i);
  if (match && !isGenericBeatArticle(match[0], player.name)) return match[0].trim();
  return null;
}

/** Insider scouting note — separate from projection; never duplicate rankNote body. */
function verifiedInsiderIntel(player, rankNoteText) {
  const intel = firstVerifiedIntel(
    player,
    ['insiderNotes', 'profileNote', 'notes', 'notePreview', 'evaluatorNotes'],
    player.name
  );
  if (!intel || intel === rankNoteText) return null;
  return intel;
}

function commitMovementLabel(player) {
  if (player.movementDirection === 'up') return 'Trending up';
  if (player.movementDirection === 'down') return 'Trending down';
  return null;
}

function profileUrl(player) {
  const slug = player.slug || String(player.name || '').toLowerCase().replace(/\s+/g, '-');
  return `/vault/recruiting/player/${encodeURIComponent(slug)}`;
}

async function loadEnrichedBoard(year) {
  const board = await store.getBoard(year);
  return enrichBoard(board, false);
}

function classCommitMetricLabel(year) {
  const calendarYear = new Date().getFullYear();
  return Number(year) <= calendarYear ? 'Signees' : 'Commits';
}

async function buildHubTicker(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = enriched.commits || [];
  const targets = enriched.targets || [];
  const rank = enriched.rankings?.nationalRank;
  const chip = blueChipPct(commits);
  const items = [];
  const countLabel = classCommitMetricLabel(year).toLowerCase();

  if (rank) items.push(`${year} class trending nationally — UF at #${rank}`);
  if (chip != null) items.push(`Blue chip % at ${chip}%`);
  if (commits.length) items.push(`${commits.length} ${countLabel} locked for ${year}`);

  const { buildHubMovementFeed } = require('./recruiting-hub-data');
  const feed = await buildHubMovementFeed(year);
  for (const row of feed.slice(0, 4 - items.length)) {
    if (row.summary) items.push(row.summary);
  }

  return items.slice(0, 4);
}

async function buildHubClassOverview(year = 2027) {
  const enriched = await loadEnrichedBoard(year);
  const commits = enriched.commits || [];
  const targets = enriched.targets || [];
  const chip = blueChipPct(commits);
  const avg = avgRating(commits);

  let rising = 0;
  let falling = 0;
  try {
  const { buildMovementSummaryPayload } = require('../api/recruiting/movement-summary.ts');
  const summary = await buildMovementSummaryPayload(year);
  rising = summary.rising ?? 0;
  falling = summary.falling ?? 0;
  } catch {
    rising = targets.filter((p) => p.movementDirection === 'up').length;
    falling = targets.filter((p) => p.movementDirection === 'down').length;
  }

  const commitCount = commits.length;

  const rankTrend = trendFromDelta(rising - falling);
  const chipTrend = rising > falling ? 'up' : falling > rising ? 'down' : 'stable';
  const commitTrend = commitCount > 0 ? 'up' : 'stable';
  const ratingTrend = rising >= 2 ? 'up' : rising === 0 && falling > 0 ? 'down' : 'stable';

  return {
    classRank: enriched.rankings?.nationalRank != null ? `#${enriched.rankings.nationalRank}` : '—',
    blueChip: chip != null ? `${chip}%` : '—',
    commits: commitCount ? String(commitCount) : '—',
    commitLabel: classCommitMetricLabel(year),
    avgRating: avg != null ? formatRating(avg) : '—',
    trendRank: trendDisplay(rankTrend),
    trendBlueChip: trendDisplay(chipTrend),
    trendCommits: trendDisplay(commitTrend),
    trendRating: trendDisplay(ratingTrend),
    sparklines: {
      classRank: null,
      blueChip: null,
      commits: null,
      avgRating: null,
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
  return null;
}

function formatStrengths(player) {
  return verifiedStrengthsList(player);
}

function formatWeaknesses(player) {
  const { isVerifiedScoutingTrait } = require('./recruiting-intel-quality');
  const list = player.weaknesses;
  if (!Array.isArray(list) || !list.length) return null;
  const cleaned = list
    .map((item) => String(item || '').trim())
    .filter((s) => isVerifiedScoutingTrait(s, player.name));
  return cleaned.length ? cleaned.slice(0, 2).join(' · ') : null;
}

function mapHubCommit(player, classYear) {
  const pct = parseUfPct(player.ufProbability);
  const slug = player.slug || player.name;
  const note = rankNote(player);
  const projection = verifiedProjection(player);
  const insider = verifiedInsiderIntel(player, note);
  const strengths = formatStrengths(player);
  const isFutureCommit = classYear >= 2027;
  return {
    id: slug,
    name: player.name,
    position: playerPos(player),
    rating: formatRating(player.displayRating ?? player.rating ?? player.vaultGrade),
    rankNote: note,
    commitDate: formatCommitDate(player),
    statusBadge: isFutureCommit ? commitStatusBadge(player) : 'Enrolled',
    profileUrl: profileUrl(player),
    stabilityMeter: isFutureCommit ? stabilityMeter(player) : null,
    ufPercent: !isFutureCommit && pct > 0 ? `${pct}%` : null,
    movement: isFutureCommit ? commitMovementLabel(player) : movementLabel(player),
    enrolled: classYear <= 2026,
    jerseyNumber: player.jerseyNumber ?? player.jersey ?? null,
    positionRoomFit: player.schemeFit ?? (player.fitScore != null ? `Fit ${Math.round(Number(player.fitScore))}/100` : null),
    earlyImpactProjection: projection,
    strengths,
    weaknesses: formatWeaknesses(player),
    playerComp: player.playerComp ?? player.comp ?? null,
    gvGrade: formatRating(player.vaultGrade ?? player.displayRating ?? player.rating),
    nilEstimate: formatNilEstimate(player),
    projection,
    insiderIntel: insider,
  };
}

async function buildHubCommits(year = 2027) {
  const commits = await store.getHubCommits(year);
  const { enrichBoard } = require('./recruiting-board-enrich');
  const enriched = enrichBoard({ classYear: year, commits, targets: [], rankings: null }, false);
  const rows = enriched.commits || commits;

  return rows.map((player) => mapHubCommit(player, year));
}

async function buildHubClassOverviewAll() {
  const years = [2026, 2027, 2028];
  const entries = await Promise.all(
    years.map(async (year) => [year, await buildHubClassOverview(year)])
  );
  return Object.fromEntries(entries);
}

async function buildHubBattles(year = 2027) {
  const hubData = require('./recruiting-hub-data');
  const dataset = await hubData.loadHubDataset({ classYears: [year] });
  const players = [...dataset.players.values()].filter(
    (p) => !p.isCommit && Number(p.classYear) === year
  );
  return hubData.buildBattlesListRows(players);
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


async function buildHubHeatIndex(year = 2027) {
  const hubData = require('./recruiting-hub-data');
  const dataset = await hubData.loadHubDataset({ classYears: [year] });
  const players = [...dataset.players.values()].filter(
    (p) => !p.isCommit && Number(p.classYear) === year
  );
  return hubData.buildHeatIndexRows(players);
}

async function buildHubMovementFeed(year = 2027) {
  const hubData = require('./recruiting-hub-data');
  return hubData.buildHubMovementFeed(year);
}

async function buildHubBattleBoard(year = 2027) {
  const hubData = require('./recruiting-hub-data');
  return hubData.buildHubBattleBoard(year);
}

async function buildHubFootprint(year = 2027) {
  const hubData = require('./recruiting-hub-data');
  return hubData.buildHubFootprint(year);
}

const HERO_CLASS_YEARS = [2026, 2027, 2028];

/** Lightweight hero payload — title, year tabs, summary metrics, ticker only. */
async function buildHubHero(year = 2027) {
  const [ticker, classOverview, classOverviewAll] = await Promise.all([
    buildHubTicker(year),
    buildHubClassOverview(year),
    buildHubClassOverviewAll(),
  ]);

  return {
    year,
    title: 'Recruiting Command Center',
    subtitle: "UF's class, movement, and battles—one place.",
    classYears: HERO_CLASS_YEARS,
    ticker,
    classOverview,
    classOverviewAll,
  };
}

/** Single payload for Recruiting Hub elite landing — one cache key, one client fetch. */
async function buildHubBundle(year = 2027) {
  const [
    ticker,
    classOverview,
    classOverviewAll,
    commits,
    battles,
    positions,
    heatIndex,
    movementFeed,
    battleBoard,
    footprint,
  ] = await Promise.all([
    buildHubTicker(year),
    buildHubClassOverview(year),
    buildHubClassOverviewAll(),
    buildHubCommits(year),
    buildHubBattles(year),
    buildHubPositions(year),
    buildHubHeatIndex(year),
    buildHubMovementFeed(year),
    buildHubBattleBoard(year),
    buildHubFootprint(year),
  ]);

  return {
    year,
    ticker,
    classOverview,
    classOverviewAll,
    commits,
    battles,
    positions,
    heatIndex,
    movementFeed,
    battleBoard,
    footprint,
  };
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
  buildHubHero,
  buildHubBundle,
};
