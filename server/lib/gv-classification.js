/**
 * Shared feed/alert classification for GatorVault.
 * Event types: commit | visit | offer | prediction | portal | trending | info
 * Visits must NEVER be labeled as commits. Unknown events default to info.
 */

const GV_COMMIT_MIN_CLASS = 2027;
const GV_PORTAL_MIN_CLASS = 2027;

const FEED_CATEGORIES = [
  'commit',
  'portal',
  'visit',
  'offer',
  'prediction',
  'trending',
  'info',
  'article',
  'score',
  'thread'
];

const VISIT_TYPES = new Set([
  'official_visit',
  'unofficial_visit',
  'visit',
  'ov',
  'uv',
  'scheduled_visit',
  'visit_scheduled'
]);

const PREDICTION_TYPES = new Set([
  'prediction',
  'rpm',
  'crystal_ball',
  'crystalball',
  'ranking_change',
  'forecast',
  'insider_prediction'
]);

const TRENDING_TYPES = new Set(['trending', 'heat_check', 'heat-check', 'momentum']);

const COMMIT_TYPES = new Set(['commit', 'flip', 'decommit']);

const PORTAL_TYPES = new Set(['portal_in', 'portal_out', 'portal']);

const OFFER_TYPES = new Set(['offer', 'target_update', 'offers']);

function getClassYear(player) {
  if (!player || player.classYear == null) return null;
  const cy = Number(player.classYear);
  return Number.isNaN(cy) ? null : cy;
}

function formatPortalTitle(title) {
  let t = String(title || '').trim();
  if (/ commits to Florida/i.test(t)) return t.replace(/ commits to Florida/i, ' enrolls via portal');
  if (/ committed to Florida/i.test(t)) return t.replace(/ committed to Florida/i, ' transfers to Florida');
  return t || 'Portal update';
}

function isVisitEventType(eventType) {
  const et = String(eventType || '').toLowerCase().trim();
  if (VISIT_TYPES.has(et)) return true;
  if (et === 'ov' || et === 'uv') return true;
  return /official_visit|unofficial_visit|scheduled_visit|_visit|visit_/.test(et);
}

/**
 * Resolve canonical event badge type from event metadata.
 * Default: info — never commit unless event is an explicit commit/flip/decommit.
 */
function isPlayerFloridaCommit(player) {
  if (!player) return false;
  const status = String(player.status || '').toLowerCase();
  const committedTo = String(player.committedTo || player.committed_to || '').trim();
  return status === 'committed' && /^florida$/i.test(committedTo);
}

function resolveEventType(eventType, player, rawType) {
  const et = String(eventType || rawType || '').toLowerCase().trim();
  const cy = getClassYear(player);
  const cat = player?.category || null;

  if (isVisitEventType(et)) return 'visit';

  if (OFFER_TYPES.has(et) || cat === 'target') return 'offer';

  if (PORTAL_TYPES.has(et)) {
    if (cy != null && cy >= GV_PORTAL_MIN_CLASS) return 'portal';
    return 'info';
  }

  if (PREDICTION_TYPES.has(et)) return 'prediction';

  if (TRENDING_TYPES.has(et)) return 'trending';

  if (COMMIT_TYPES.has(et)) {
    if (cat === 'portal') {
      if (cy != null && cy >= GV_PORTAL_MIN_CLASS) return 'portal';
      return 'info';
    }
    if (cy != null && cy >= GV_COMMIT_MIN_CLASS && cat !== 'portal' && isPlayerFloridaCommit(player)) {
      return 'commit';
    }
    return 'info';
  }

  if (cat === 'portal' && cy != null && cy >= GV_PORTAL_MIN_CLASS) return 'portal';

  if (et === 'visit') return 'visit';
  if (et === 'offer' || et === 'offers') return 'offer';
  if (et === 'prediction') return 'prediction';
  if (et === 'trending') return 'trending';
  if (et === 'commit') return 'info';
  if (et === 'portal') return cy != null && cy >= GV_PORTAL_MIN_CLASS ? 'portal' : 'info';

  return 'info';
}

function classifyRecruitPlayer(player, eventType) {
  return resolveEventType(eventType, player);
}

function classifyFeedItemType(item, playerIndex) {
  const raw = String(item?.type || '').toLowerCase();
  if (raw === 'article') return 'article';
  if (raw === 'score') return 'score';
  if (raw === 'thread') return 'thread';

  const slug = item?.meta?.playerSlug || '';
  const idx = playerIndex || { bySlug: new Map(), portalSlugs: new Set() };
  const player =
    item?.meta?.player || (slug && idx.bySlug ? idx.bySlug.get(slug) : null) || null;
  const eventType = item?.meta?.eventType || null;

  if (eventType) {
    return resolveEventType(eventType, player, raw);
  }

  if (raw === 'visit') return 'visit';
  if (raw === 'offer' || raw === 'offers') return 'offer';
  if (raw === 'prediction') return 'prediction';
  if (raw === 'trending') return 'trending';
  if (raw === 'info') return 'info';
  if (raw === 'commit' || raw === 'flip' || raw === 'decommit') {
    return resolveEventType(raw, player);
  }
  if (raw === 'portal') {
    return resolveEventType('portal_in', player);
  }

  return resolveEventType(raw, player);
}

function shouldSuppressRecruitItem(item, playerIndex) {
  const type = classifyFeedItemType(item, playerIndex);
  if (['visit', 'offer', 'prediction', 'trending', 'info', 'article', 'score', 'thread'].includes(type)) {
    return false;
  }
  return type == null && (item?.meta?.playerSlug || item?.meta?.eventType);
}

function eventTypeLabel(type, meta) {
  const t = String(type || '').toLowerCase();
  if (t === 'visit' && meta?.status) return 'Visit';
  const labels = {
    commit: 'Commit',
    visit: 'Visit',
    offer: 'Offer',
    prediction: 'Prediction',
    portal: 'Portal',
    trending: 'Trending',
    info: 'Info'
  };
  return labels[t] || t || 'Info';
}

module.exports = {
  GV_COMMIT_MIN_CLASS,
  GV_PORTAL_MIN_CLASS,
  FEED_CATEGORIES,
  getClassYear,
  formatPortalTitle,
  isVisitEventType,
  isPlayerFloridaCommit,
  resolveEventType,
  classifyRecruitPlayer,
  classifyFeedItemType,
  shouldSuppressRecruitItem,
  eventTypeLabel
};
