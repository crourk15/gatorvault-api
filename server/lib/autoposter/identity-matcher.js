/**
 * Autoposter Identity Matcher
 * intel → playerId, name, position, class year, rating, UF probability, movement delta
 */
const recruitingStore = require('../recruiting-store');
const dataLayer = require('../x-autoposter-data-layer');

function mapPlayerRecord(player) {
  if (!player) return null;
  return {
    playerId: player.id || player.slug,
    name: player.name,
    position: player.pos,
    classYear: player.classYear,
    rating: player.rating || player.stars,
    ufProbability: player.ufProbability ?? player.ufRpmPct ?? null,
    movementDelta: player.movementDelta ?? player.delta ?? 0
  };
}

function matchIntelToPlayer(intel) {
  intel = intel || {};
  const player =
    (intel.playerSlug && recruitingStore.findBySlug(intel.playerSlug)) ||
    (intel.playerName && recruitingStore.findByNameAndClass(intel.playerName, intel.classYear));
  return mapPlayerRecord(player);
}

async function matchIdentity(intel) {
  intel = intel || {};
  const stub = matchIntelToPlayer(intel);
  const intelInput = {
    playerName: intel.playerName || stub?.name,
    playerSlug: intel.playerSlug || stub?.playerId,
    playerId: intel.playerId || stub?.playerId,
    pos: intel.pos || stub?.position,
    classYear: intel.classYear || stub?.classYear,
    detail: intel.detail || intel.beatText || intel.text,
    beatText: intel.beatText || intel.detail || intel.text,
    eventType: intel.eventType,
    source: intel.source,
    sourceHandle: intel.sourceHandle,
    timestamp: intel.timestamp || intel.reportedAt || intel.createdAt,
    directlyInvolvesUF: intel.directlyInvolvesUF,
    visitStart: intel.visitStart,
    visitEnd: intel.visitEnd
  };

  const playerData = await dataLayer.fetchAutoposterPlayerData(intelInput);
  if (!playerData.ok) {
    return {
      ok: false,
      skipReason: playerData.skipReason,
      reason: playerData.reason,
      missingFields: playerData.missingFields || [],
      playerName: playerData.playerName || intel.playerName,
      stub
    };
  }

  return {
    ok: true,
    ...mapPlayerRecord({
      id: playerData.identity?.playerSlug || playerData.data?.playerSlug,
      slug: playerData.data?.playerSlug,
      name: playerData.data.name,
      pos: playerData.data.position,
      classYear: playerData.data.class || playerData.identity?.classYear,
      rating: playerData.data.rating,
      ufProbability: playerData.rewriteMetrics?.ufProbability,
      movementDelta: playerData.rewriteMetrics?.movementDelta,
      delta: playerData.rewriteMetrics?.movementDelta
    }),
    visitType: playerData.rewriteMetrics?.visitType || intel.eventType || null,
    sourceCredibility: playerData.rewriteMetrics?.sourceCredibility || intel.source || null,
    identity: playerData.identity,
    ctx: playerData.ctx,
    data: playerData.data,
    situation: playerData.situation,
    rewriteMetrics: playerData.rewriteMetrics
  };
}

module.exports = {
  matchIntelToPlayer,
  matchIdentity,
  mapPlayerRecord
};
