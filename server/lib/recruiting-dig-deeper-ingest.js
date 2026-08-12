/**
 * Phase 1 dig-deeper — shared beat/on3 visit/offer log + competitor merge hooks.
 */
const visitLogStore = require('./recruiting-visit-log-store');
const offerLogStore = require('./recruiting-offer-log-store');
const { mergeCompetitorsOnPlayer } = require('./recruiting-competitor-merge');
const { isOfficialVisitType } = require('./visit-intel-utils');

const VISIT_EVENT_TYPES = new Set([
  'home_visit',
  'official_visit',
  'unofficial_visit',
  'visit_cancelled',
  'ov_change',
  'visit',
]);

function competitorEntriesFromIntel(enrichedIntel, source, updatedAt) {
  const entries = [];
  const ts = updatedAt || new Date().toISOString();
  if (enrichedIntel?.competitorSchool) {
    entries.push({ school: enrichedIntel.competitorSchool, source, updatedAt: ts });
  }
  for (const mention of enrichedIntel?.competitorMentions || []) {
    const name = typeof mention === 'string' ? mention : mention?.school || mention?.name;
    if (!name) continue;
    entries.push({ school: name, source, updatedAt: ts });
  }
  return entries;
}

function visitTypeForBeatEvent(eventType) {
  const et = String(eventType || '').toLowerCase();
  if (et === 'ov_change' || et === 'ov') return 'official_visit';
  if (et === 'visit') return 'unofficial_visit';
  return et;
}

async function recordBeatVisitLog(row, player, source = 'auto:beat-writer') {
  const eventType = String(row.eventType || '').toLowerCase();
  if (!VISIT_EVENT_TYPES.has(eventType)) return null;
  if (eventType === 'visit_cancelled') return null; // cancel alerts use beat-visit-intel path
  const reportedAt = row.timestamp || row.reportedAt || new Date().toISOString();
  const school =
    eventType === 'ov_change' ? row.cancelledSchool || 'Florida' : 'Florida';
  const visitType = visitTypeForBeatEvent(eventType);
  return visitLogStore.appendVisitLog({
    playerSlug: player.slug,
    playerId: player.on3Id || row.on3Id,
    playerName: player.name,
    school,
    visitType,
    date: row.visitStart || row.visitDates || reportedAt,
    source,
    reportedAt,
    detail: row.detail,
    // Beat writer only reaches here after identity confirmation.
    identityConfirmed: row.identityConfirmed !== false,
  });
}

async function recordBeatOfferLog(row, player, source = 'auto:beat-writer') {
  const eventType = String(row.eventType || '').toLowerCase();
  const detail = String(row.detail || row.text || '');
  const isOffer = eventType === 'offer' || /\boffer(?:ed|s)?\b/i.test(detail);
  if (!isOffer) return null;
  const reportedAt = row.timestamp || row.reportedAt || new Date().toISOString();
  return offerLogStore.appendOfferLog({
    playerSlug: player.slug,
    playerId: player.on3Id || row.on3Id,
    school: 'Florida',
    offerType: eventType === 'offer' ? 'offer' : 'reported',
    date: reportedAt,
    source,
    reportedAt,
    detail: row.detail || detail.slice(0, 280),
  });
}

async function recordBeatCompetitorMerge(enrichedIntel, player, source = 'auto:beat-writer') {
  const entries = competitorEntriesFromIntel(
    enrichedIntel,
    source,
    enrichedIntel?.timestamp || enrichedIntel?.reportedAt
  );
  if (!entries.length) return null;
  return mergeCompetitorsOnPlayer(player.slug, entries);
}

/**
 * Write dig-deeper logs and fan out push/email for newly created verified Florida OVs.
 */
async function recordBeatDigDeeper(row, player, enrichedIntel, source = 'auto:beat-writer') {
  const visitLog = await recordBeatVisitLog(row, player, source);
  await recordBeatOfferLog(row, player, source);
  await recordBeatCompetitorMerge(enrichedIntel, player, source);

  let visitAlerts = null;
  if (visitLog?.created && visitLog.item && isOfficialVisitType(visitLog.item.visitType)) {
    try {
      const { handleNewVerifiedVisitLogs } = require('./visit-intel-ingest-hooks');
      visitAlerts = await handleNewVerifiedVisitLogs([visitLog.item]);
    } catch (err) {
      visitAlerts = {
        processed: 0,
        queued: 0,
        error: err instanceof Error ? err.message : String(err),
      };
      console.warn('[dig-deeper] visit alert fanout failed:', visitAlerts.error);
    }
  }

  return { visitLog, visitAlerts };
}

module.exports = {
  VISIT_EVENT_TYPES,
  competitorEntriesFromIntel,
  recordBeatVisitLog,
  recordBeatOfferLog,
  recordBeatCompetitorMerge,
  recordBeatDigDeeper,
  visitTypeForBeatEvent,
};
