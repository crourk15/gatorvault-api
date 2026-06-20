/**
 * Phase 1 dig-deeper — shared beat/on3 visit/offer log + competitor merge hooks.
 */
const visitLogStore = require('./recruiting-visit-log-store');
const offerLogStore = require('./recruiting-offer-log-store');
const { mergeCompetitorsOnPlayer } = require('./recruiting-competitor-merge');

const VISIT_EVENT_TYPES = new Set([
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

async function recordBeatVisitLog(row, player, source = 'auto:beat-writer') {
  const eventType = String(row.eventType || '').toLowerCase();
  if (!VISIT_EVENT_TYPES.has(eventType)) return null;
  const reportedAt = row.timestamp || row.reportedAt || new Date().toISOString();
  const school =
    eventType === 'visit_cancelled' || eventType === 'ov_change'
      ? row.cancelledSchool || 'Florida'
      : 'Florida';
  return visitLogStore.appendVisitLog({
    playerSlug: player.slug,
    playerId: player.on3Id || row.on3Id,
    playerName: player.name,
    school,
    visitType: eventType,
    date: row.visitStart || reportedAt,
    source,
    reportedAt,
    detail: row.detail,
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

async function recordBeatDigDeeper(row, player, enrichedIntel, source = 'auto:beat-writer') {
  await recordBeatVisitLog(row, player, source);
  await recordBeatOfferLog(row, player, source);
  await recordBeatCompetitorMerge(enrichedIntel, player, source);
}

module.exports = {
  VISIT_EVENT_TYPES,
  competitorEntriesFromIntel,
  recordBeatVisitLog,
  recordBeatOfferLog,
  recordBeatCompetitorMerge,
  recordBeatDigDeeper,
};
