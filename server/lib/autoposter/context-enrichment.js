/**
 * Autoposter Context Enrichment
 */
const futurecastStore = require('../futurecast-store');
const intelHistoryStore = require('../recruiting-intel-store');
const dataLayer = require('../x-autoposter-data-layer');
const insiderPrompt = require('../x-autoposter-insider-prompt');
const fs = require('fs');
const path = require('path');

const STAFF_PATH = path.join(__dirname, '..', 'data', 'coaching-staff.json');

function resolveStaffContacts(player = {}, intel = {}) {
  if (Array.isArray(intel.staffContacts) && intel.staffContacts.length) return intel.staffContacts;
  try {
    const doc = JSON.parse(fs.readFileSync(STAFF_PATH, 'utf8'));
    const pos = String(player.position || player.pos || intel.pos || '').toUpperCase();
    const unitMap = { WR: 'wr', RB: 'rb', QB: 'qb', TE: 'te', OL: 'ol', DL: 'dl', LB: 'lb', DB: 'db' };
    const unit = unitMap[pos] || pos.toLowerCase();
    const coaches = (doc.coaches || []).filter(
      (c) => String(c.unit || '').toLowerCase() === unit || String(c.title || '').toUpperCase().includes(pos)
    );
    return coaches.slice(0, 2).map((c) => c.name).filter(Boolean);
  } catch {
    return [];
  }
}

function enrichContext(player = {}, intel = {}) {
  const futurecast = futurecastStore.getByPlayerId(player.playerId || player.slug);
  const history = intelHistoryStore.getHistoryForPlayer(player.playerId || player.slug);
  const staffContacts = resolveStaffContacts(player, intel);
  const isPredictionEvent = ['prediction', 'prediction_change'].includes(String(intel.eventType || '').toLowerCase());
  const priorConfidence =
    intel.priorConfidencePct ??
    futurecast?.priorConfidence ??
    (isPredictionEvent && intel.confidencePct != null && intel.movementDelta != null
      ? Number(intel.confidencePct) - Number(intel.movementDelta)
      : null);
  const movementDelta =
    intel.movementDelta ??
    futurecast?.movementDelta ??
    (priorConfidence != null && intel.confidencePct != null
      ? Number(intel.confidencePct) - Number(priorConfidence)
      : player.movementDelta);

  return {
    visitType: isPredictionEvent ? 'prediction_change' : intel.eventType,
    visitDates: intel.visitDates || intel.visitStart || null,
    visitStart: intel.visitStart || null,
    visitEnd: intel.visitEnd || null,
    staffContacts,
    competition: futurecast?.competition || [],
    timeline: futurecast?.timeline || 'summer decision',
    ufProbability: futurecast?.ufProbability ?? intel.confidencePct ?? player.ufProbability,
    priorConfidence,
    movementDelta,
    fitScore: futurecast?.fitScore ?? null,
    predictionSchool: intel.predictionSchool || 'Florida Gators',
    history,
    predictionHistory: futurecast?.predictionHistory || []
  };
}

async function enrichContextFull(identity = {}, intel = {}, research = null) {
  const metrics = await dataLayer.enrichRewriteMetrics(identity, intel);
  const visitType = insiderPrompt.formatVisitType(intel, research?.eventType || intel?.eventType);
  const intelHistory = (research?.intelRows || [])
    .slice(0, 5)
    .map((row) => ({
      eventType: row.eventType,
      detail: row.detail,
      reportedAt: row.reportedAt || row.timestamp
    }));

  return {
    ...enrichContext(
      {
        playerId: identity.playerSlug || identity.slug,
        ufProbability: metrics.ufProbability,
        movementDelta: metrics.movementDelta
      },
      intel
    ),
    metrics,
    visitType,
    visitStart: metrics.visitStart || intel.visitStart || null,
    visitEnd: metrics.visitEnd || intel.visitEnd || null,
    visitHistory: intelHistory.filter((r) => /visit/i.test(String(r.eventType || ''))),
    staffRelationships: research?.staffInvolved || [],
    intelHistory,
    classNeeds: null,
    sourceCredibility: metrics.sourceCredibility
  };
}

module.exports = {
  enrichContext,
  enrichContextFull
};
