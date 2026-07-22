/**
 * GatorVault Player Intelligence — unified read API.
 * Single source of truth for Detectives, PR-789, FutureCast, and Recruiting Hub.
 */
const store = require('../recruiting-store');
const intelStore = require('../recruiting-intel-store');
const visitLogStore = require('../recruiting-visit-log-store');
const offerLogStore = require('../recruiting-offer-log-store');
const { enrichHubPlayer } = require('../recruiting-hub-data');
const {
  buildAllRankingBlocks,
  selectRankingBlock,
  rankingTokensFromBlock
} = require('./ranking-blocks');
const { detectGaps, detectStale, offersCompleteness, visitsCompleteness } = require('./gaps');
const { computeMomentum } = require('./momentum');
const { resolveCoverageTier } = require('./tiers');
const observationsStore = require('./observations-store');

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function parseUfPct(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  return Math.min(100, Math.max(0, Math.round(n <= 1 ? n * 100 : n)));
}

function buildOffers(player = {}, offerLogs = []) {
  const out = [];
  const seen = new Set();
  for (const o of player.offers || []) {
    const school = typeof o === 'string' ? o : o?.school || o?.schoolName;
    if (!school) continue;
    const key = String(school).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      school: String(school),
      source: o?.source || 'store',
      observedAt: o?.date || o?.offerDate || player.updatedAt || null,
      sourceUrl: o?.sourceUrl || null
    });
  }
  for (const row of offerLogs) {
    const school = row.school || row.offerSchool;
    if (!school) continue;
    const key = String(school).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      school: String(school),
      source: row.source || 'offer_log',
      observedAt: row.timestamp || row.date || null,
      sourceUrl: row.sourceUrl || null
    });
  }
  return out;
}

function buildVisits(player = {}, visitLogs = [], intelRows = []) {
  const out = [];
  const seen = new Set();
  const push = (school, visitType, visitDate, source, sourceUrl) => {
    if (!school && !visitDate) return;
    const key = `${String(school || '').toLowerCase()}|${String(visitDate || '').slice(0, 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      school: school ? String(school) : 'Florida',
      visitType: visitType || 'visit',
      visitDate: visitDate || null,
      source: source || 'store',
      sourceUrl: sourceUrl || null
    });
  };

  if (player.visitStart) {
    push(player.nextVisitSchool || 'Florida', player.ufOvStatus || 'visit', player.visitStart, 'store');
  }
  for (const v of player.visits || []) {
    push(
      v.school || v.visitSchool || v.host,
      v.visitType || v.type || 'visit',
      v.date || v.visitDate || v.visitStart,
      v.source || 'store',
      v.sourceUrl
    );
  }
  for (const row of visitLogs) {
    push(row.school || row.visitSchool, row.visitType || row.type, row.date || row.visitDate, 'visit_log');
  }
  for (const row of intelRows) {
    if (!/visit/i.test(String(row.eventType || ''))) continue;
    push(row.school, row.eventType, row.visitStart || row.timestamp, 'intel', row.sourceUrl);
  }
  return out.sort((a, b) => String(b.visitDate || '').localeCompare(String(a.visitDate || '')));
}

function buildRpm(player = {}, intelRows = []) {
  let ufPct = parseUfPct(player.ufRpmPct ?? player.ufProbability);
  let observedAt = player.updatedAt || null;
  let source = player.ufRpmPct != null ? 'on3' : player.ufProbability != null ? 'store' : null;
  let sourceUrl = player.on3ProfileUrl || null;

  if (ufPct == null) {
    for (const row of intelRows) {
      const pct = parseUfPct(row.ufRpmPct ?? row.confidencePct);
      if (pct != null) {
        ufPct = pct;
        observedAt = row.timestamp || observedAt;
        source = row.source || 'intel';
        sourceUrl = row.sourceUrl || sourceUrl;
        break;
      }
    }
  }

  return {
    ufPct,
    school: 'Florida',
    source,
    observedAt,
    sourceUrl,
    rivalsPrediction: player.rivalsLastPrediction || null
  };
}

function buildBoardState(player = {}, enriched = {}) {
  return {
    isTarget: player.isTarget === true || player.category === 'target',
    isCommit: player.isCommit === true || player.category === 'commit' || !!player.committedTo,
    tier: player.tier || null,
    onBoard: player.isTarget === true || player.isCommit === true || player.category === 'target',
    battleDifficulty: enriched.battleDifficulty || null,
    laneStatus: null
  };
}

async function getPlayerIntelligence(slugOrId, opts = {}) {
  const key = normalizeSlug(slugOrId);
  if (!key) return null;

  const player =
    (typeof store.resolvePlayerKey === 'function' ? await store.resolvePlayerKey(key) : null) ||
    (await store.getPlayerBySlug(key));
  if (!player) return null;

  const slug = normalizeSlug(player.slug || key);
  const intelRows =
    intelStore.getIntelForPlayer({
      playerSlug: slug,
      playerId: player.on3Id || player.id,
      playerName: player.name
    }) || [];
  // Pass playerSlug so older Florida visits/offers are not dropped by a global 500-row window.
  const visitLogs = visitLogStore.listVisitLogs({ playerSlug: slug, limit: 100 }) || [];
  const offerLogs = offerLogStore.listOfferLogs({ playerSlug: slug, limit: 100 }) || [];

  const enriched = enrichHubPlayer(player, { intelRows, visitLogs, offerLogs });
  const rankingBlocks = buildAllRankingBlocks(player);
  const rankingBlock = selectRankingBlock(rankingBlocks);
  const rankingTokens = rankingTokensFromBlock(rankingBlock);

  const offers = buildOffers(player, offerLogs);
  const visits = buildVisits(player, visitLogs, intelRows);
  const offersMeta = offersCompleteness(offers);
  const visitsMeta = visitsCompleteness(visits);
  const rpm = buildRpm(player, intelRows);
  const board = buildBoardState(player, enriched);
  const coverageTier = opts.coverageTier || (await resolveCoverageTier(slug));
  const priorSnapshot = observationsStore.latestSnapshot(slug);

  const partial = {
    gvPlayerId: slug,
    slug,
    identity: {
      name: player.name,
      classYear: player.classYear,
      pos: player.pos || player.position,
      school: player.school || player.highSchool,
      hometownState: player.hometownState || player.state,
      on3Id: player.on3Id,
      on3Slug: player.on3Slug,
      on3ProfileUrl: player.on3ProfileUrl,
      slug,
      updatedAt: player.updatedAt || null
    },
    rankingBlock,
    rankingBlocks,
    rankingTokens,
    offers,
    visits,
    offersCompleteness: offersMeta,
    visitsCompleteness: visitsMeta,
    rpm,
    board,
    competitors: enriched.competitors || [],
    coverageTier
  };

  partial.momentum = computeMomentum({
    player,
    offers,
    visits,
    rpm,
    priorSnapshot
  });
  partial.gaps = detectGaps(partial);
  partial.stale = detectStale(partial);
  partial.meta = {
    generatedAt: new Date().toISOString(),
    dataSource: store.getStoreInfo?.() || { mode: 'unknown' }
  };

  return partial;
}

module.exports = {
  getPlayerIntelligence,
  buildOffers,
  buildVisits,
  buildRpm
};
