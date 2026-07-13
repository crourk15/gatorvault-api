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
  isCompositeBio,
  isChaseProcessIntel,
  firstVerifiedIntel,
  verifiedStrengthsList,
  isVerifiedScoutingTrait,
} = require('./recruiting-intel-quality');

const RANK_LINE_SEP = ' | ';

function hometownLabel(player) {
  const school = String(player.school || player.fromSchool || '').trim();
  const city = String(player.hometownCity || player.city || '').trim();
  const state = String(player.state || player.hometownState || '').trim();
  if (school && state && !school.includes(state)) return `${school}, ${state}`;
  if (school) return school;
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  return '';
}

function buildCommitMetaLine(player) {
  const pos = playerPos(player);
  const stars = effectiveStars(player) || 0;
  const parts = [];
  if (stars) parts.push(`${stars}★ ${pos}`);
  else if (pos) parts.push(pos);
  const home = hometownLabel(player);
  if (home) parts.push(home);
  const natl = player.natlRank ?? player.natl;
  if (natl != null) parts.push(`#${natl} natl`);
  return parts.join(' · ') || fallbackCommitBlurb(player);
}

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

/**
 * Fan-facing commit skinny — who they are and why the get matters.
 * Prefer real scouting notes; otherwise write an honest factual story (never On3 composite bios as "intel").
 * Strengths / projection render as card callouts — keep this paragraph about the get itself.
 */
function buildCommitFanSkinny(player) {
  const name = String(player.name || 'This commit').trim();
  const pos = playerPos(player);
  const stars = effectiveStars(player) || 0;
  const home = hometownLabel(player);
  const htWt = String(player.htWt || '').trim();
  const natl = player.natlRank ?? player.natl;
  const posRank = player.posRank;

  const verified = firstVerifiedIntel(
    player,
    // Prefer true scouting fields; profileNote/notes often hold chase templates.
    ['evaluatorNotes', 'evaluationSummary', 'insiderNotes', 'skinny', 'profileNote', 'notes'],
    player.name
  );
  if (
    verified &&
    verified.length >= 40 &&
    !isCompositeBio(verified) &&
    !isChaseProcessIntel(verified)
  ) {
    return verified.length > 360 ? `${verified.slice(0, 357).trim()}…` : verified;
  }

  const sentences = [];
  let open = `${name} committed to Florida`;
  if (stars) open += ` as a ${stars}-star ${pos}`;
  else if (pos && pos !== '—') open += ` at ${pos}`;
  if (home) open += ` out of ${home}`;
  open += '.';
  sentences.push(open);

  const facts = [];
  if (htWt) facts.push(`Listed at ${htWt}`);
  if (natl != null) facts.push(`#${natl} nationally`);
  if (posRank != null && pos && pos !== '—') facts.push(`#${posRank} among ${pos}s`);
  if (player.inState) facts.push('In-state get');
  if (player.headliner) facts.push('Class headliner');
  if (facts.length) sentences.push(`${facts.join(' · ')}.`);

  const scheme = String(player.schemeFit || '').trim();
  if (
    scheme &&
    scheme.length >= 20 &&
    isVerifiedScoutingTrait(scheme, player.name) &&
    !isCompositeBio(scheme)
  ) {
    sentences.push(scheme.endsWith('.') ? scheme : `${scheme}.`);
  }

  const comp = String(player.playerComp || player.comp || '').trim();
  if (comp && comp.length >= 3 && !/^tbd$/i.test(comp)) {
    sentences.push(`Fan comp: ${comp}.`);
  }

  // If we only have the opener + thin facts, add one more honest line so fans always get substance.
  if (sentences.length < 2) {
    const bits = [];
    if (stars >= 4) bits.push('A blue-chip addition');
    else if (stars) bits.push(`A ${stars}-star addition`);
    else bits.push('A new piece');
    if (player.inState) bits.push('from inside Florida');
    if (pos && pos !== '—') bits.push(`for the ${pos} room`);
    sentences.push(`${bits.join(' ')}.`);
  }

  return sentences.join(' ');
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
  // Meta line is the factual subtitle; long skinny belongs in fanStory/skinny.
  return buildCommitMetaLine(player);
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
  // Lightweight path: targeted commit + rankings queries only (avoid getAllPlayers + movement DB).
  const [commits, rankingsList] = await Promise.all([
    store.getHubHsCommits(year),
    store.getRankings(),
  ]);
  const rankings =
    (rankingsList || []).find((r) => Number(r.classYear) === Number(year)) || null;
  const chip = blueChipPct(commits);
  const avg = avgRating(commits);
  const commitCount = commits.length;

  const rankTrend = 'stable';
  const chipTrend = chip != null && chip >= 55 ? 'up' : 'stable';
  const commitTrend = commitCount > 0 ? 'up' : 'stable';
  const ratingTrend = avg != null && Number(avg) >= 0.9 ? 'up' : 'stable';

  return {
    classRank: rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—',
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
  const metaLine = buildCommitMetaLine(player);
  const skinny = buildCommitFanSkinny(player);
  const projection = verifiedProjection(player);
  const strengths = formatStrengths(player);
  const isFutureCommit = classYear >= 2027;
  const stars = effectiveStars(player) || 0;
  const badge = isFutureCommit
    ? player.headliner
      ? 'Headliner'
      : stars >= 5
        ? '5★'
        : null
    : 'Enrolled';
  return {
    id: slug,
    name: player.name,
    position: playerPos(player),
    rating: formatRating(player.displayRating ?? player.rating ?? player.vaultGrade),
    rankNote: metaLine,
    metaLine,
    skinny,
    commitDate: formatCommitDate(player),
    statusBadge: badge || undefined,
    profileUrl: profileUrl(player),
    stabilityMeter: null,
    ufPercent: !isFutureCommit && pct > 0 ? `${pct}%` : null,
    movement: isFutureCommit ? commitMovementLabel(player) : null,
    enrolled: classYear <= 2026,
    jerseyNumber: player.jerseyNumber ?? player.jersey ?? null,
    positionRoomFit: null,
    earlyImpactProjection: projection,
    strengths,
    weaknesses: formatWeaknesses(player),
    playerComp: player.playerComp ?? player.comp ?? null,
    gvGrade: null,
    nilEstimate: formatNilEstimate(player),
    projection,
    insiderIntel: null,
    inState: Boolean(player.inState),
    stars: stars || null,
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

  return sorted.slice(0, 10).map(([label, stats]) => ({
    id: label,
    label,
    commits: stats.commits,
    targets: stats.targets,
    // Honest counts only — no canned "Room filling in" staff-speak.
    note: null,
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
    subtitle: "UF's class, commits, and battles—one place.",
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
