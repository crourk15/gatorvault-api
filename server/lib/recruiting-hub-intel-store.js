/**
 * Recruiting Hub Intel Store — intel curation + thin delegates to recruiting-hub-data.
 */
const store = require('./recruiting-store');
const { enrichBoard } = require('./recruiting-board-enrich');
const { STAFF_DIRECTORY } = require('./recruiting-staff-directory');

const HUB_CLASS_YEARS = [2026, 2027, 2028];
const VERIFIED_SOURCES = new Set(['on3', 'manual', 'rivals_pm', 'auto:beat-writer']);

const BLOCKED_SOURCE =
  /beat_writer|auto:beat(?!-writer)|twitter|x_post|x-autoposter|podcast|program_news|camp_recap|live_feed|headline/i;

const ALLOWED_INTEL_EVENTS = new Set([
  'official_visit',
  'unofficial_visit',
  'visit_cancelled',
  'ov_change',
  'visit',
  'offer',
  'prediction',
  'prediction_change',
  'rivals_futurecast',
  'ranking_change',
  'target_update',
  'staff_note',
  'momentum_up',
  'momentum_down',
  'flip_watch',
  'commit_watch',
  // Beat-writer recruiting narratives (e.g. rising names / Gators in play)
  'recruiting_narrative',
]);

const BLOCKED_SUMMARY =
  /podcast|camp recap|gator tales|gnfp|breakdown show|listen now|spotify|apple podcasts|youtube\.com\/watch/i;

function playerPos(player) {
  return player?.position || player?.pos || '—';
}

function parseUfPct(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function profileUrl(player) {
  const slug = player?.slug || String(player?.name || '').toLowerCase().replace(/\s+/g, '-');
  return `/vault/recruiting/player/${encodeURIComponent(slug)}`;
}

function isFloridaSchool(value) {
  return /florida|gators|\buf\b/i.test(String(value || ''));
}

function isRosterPlayer(player) {
  const lc = String(player?.lifecycle || '').toUpperCase();
  const cat = String(player?.category || '').toLowerCase();
  return lc === 'ROSTER' || cat === 'roster';
}

function isActivePortalTarget(player) {
  const cat = String(player?.category || '').toLowerCase();
  const st = String(player?.status || '').toLowerCase();
  const isPortal =
    cat === 'portal' ||
    st.includes('portal') ||
    String(player?.lifecycle || '').toUpperCase() === 'PORTAL';
  if (!isPortal) return false;
  if (player.isCommittedToUF) return false;
  if (player.committedTo && isFloridaSchool(player.committedTo)) return false;
  if (player.committedTo && !isFloridaSchool(player.committedTo)) return false;
  return (
    parseUfPct(player.ufProbability) >= 34 ||
    player.tier === 'TOP' ||
    player.tier === 'HIGH' ||
    player.isTarget
  );
}

function normalizePoolPlayer(player, classYear, kind) {
  return {
    slug: String(player.slug || '').toLowerCase(),
    name: player.name,
    position: playerPos(player),
    classYear: player.classYear || classYear,
    ufProbability: player.ufProbability,
    movementDirection: player.movementDirection,
    tier: player.tier,
    visitStart: player.visitStart,
    notePreview: player.notePreview,
    skinny: player.skinny,
    notes: player.notes,
    leaderSchool: player.leaderSchool ?? player.predictionLeader ?? player.topSchool ?? null,
    isCommit: kind === 'commit',
    isPortal: kind === 'portal',
    profileUrl: profileUrl(player),
  };
}

async function loadHubRecruitingPool() {
  const pool = new Map();

  for (const year of HUB_CLASS_YEARS) {
    const board = await store.getBoard(year);
    const enriched = enrichBoard(board, false);
    for (const player of enriched.targets || []) {
      if (!player.slug || isRosterPlayer(player)) continue;
      pool.set(String(player.slug).toLowerCase(), normalizePoolPlayer(player, year, 'target'));
    }
  }

  const all = await store.getAllPlayers();
  for (const player of all) {
    if (!player.slug || isRosterPlayer(player)) continue;
    const year = Number(player.classYear);
    if (isActivePortalTarget(player)) {
      pool.set(String(player.slug).toLowerCase(), normalizePoolPlayer(player, year || 2027, 'portal'));
      continue;
    }
    if (HUB_CLASS_YEARS.includes(year) && player.isTarget && !player.isCommittedToUF) {
      const slug = String(player.slug).toLowerCase();
      if (pool.has(slug)) continue;
      // Closing Class / underclassmen: board getBoard() already filtered — do not
      // re-admit durable isTarget offer-list junk into the movement pool.
      if (year === 2027 || year === 2028) {
        try {
          const {
            getAllowlistSet,
            canonicalTargetSlug,
          } = require('./recruiting-target-allowlist');
          if (!getAllowlistSet(year).has(canonicalTargetSlug(slug))) continue;
        } catch {
          continue;
        }
      }
      pool.set(slug, normalizePoolPlayer(player, year, 'target'));
    }
  }

  return pool;
}

function intelMatchesPool(row, pool) {
  const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
  if (!slug || !pool.has(slug)) return false;
  const meta = pool.get(slug);
  if (meta.isCommit) return false;
  if (meta.isPortal && row.eventType === 'offer') {
    const cy = Number(row.classYear || meta.classYear);
    if (!HUB_CLASS_YEARS.includes(cy)) return false;
  }
  return true;
}

function isCuratedHubIntel(row, pool) {
  if (!row || row.resolutionStatus === 'needs_resolution' || row.surfaced === false) return false;
  if (!row.playerSlug || !row.playerName) return false;
  if (row.ufRelevant === false) return false;
  if (!intelMatchesPool(row, pool)) return false;

  const source = String(row.source || '').toLowerCase();
  if (BLOCKED_SOURCE.test(source)) return false;
  if (!VERIFIED_SOURCES.has(source)) return false;

  const et = String(row.eventType || '').toLowerCase();
  if (!ALLOWED_INTEL_EVENTS.has(et)) return false;
  if (et === 'commit' || et === 'flip' || et === 'decommit' || et === 'portal_out') return false;
  if (et === 'portal_in' && !pool.get(String(row.playerSlug).toLowerCase())?.isPortal) return false;
  if (et === 'offer') {
    const meta = pool.get(String(row.playerSlug).toLowerCase());
    if (meta?.isPortal) return false;
  }

  const summary = String(row.detail || row.text || '').trim();
  if (!summary || summary.length < 8) return false;
  if (BLOCKED_SUMMARY.test(summary)) return false;
  if (/^https?:\/\//i.test(summary) && !row.playerName) return false;

  try {
    const beatFilters = require('./beat-writer-filters');
    const post = { handle: row.sourceHandle || row.source_handle, text: summary };
    if (!beatFilters.passesStrictUfOnlyFilter(post, summary)) return false;
  } catch {
    return false;
  }

  return true;
}

async function buildHubMovementFeed() {
  const hubData = require('./recruiting-hub-data');
  return hubData.buildHubMovementFeed();
}

async function buildHubBattleBoard() {
  const hubData = require('./recruiting-hub-data');
  return hubData.buildHubBattleBoard();
}

async function buildHubFootprint(year = null) {
  const hubData = require('./recruiting-hub-data');
  return hubData.buildHubFootprint(year);
}

module.exports = {
  loadHubRecruitingPool,
  isCuratedHubIntel,
  VERIFIED_SOURCES,
  BLOCKED_SOURCE,
  STAFF_ALLOWLIST: STAFF_DIRECTORY,
  buildHubMovementFeed,
  buildHubBattleBoard,
  buildHubFootprint,
};
