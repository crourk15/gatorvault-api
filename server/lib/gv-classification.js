/**
 * Shared feed/alert classification for GatorVault.
 * Commits: HS recruits classYear >= 2027 (2027, 2028, 2029)
 * Portal:  transfers classYear >= 2027 only — NOT 2026 roster cycle
 */

const GV_COMMIT_MIN_CLASS = 2027;
const GV_PORTAL_MIN_CLASS = 2027;
const FEED_CATEGORIES = ['commit', 'portal', 'offers', 'article', 'score', 'thread'];

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

function classifyRecruitPlayer(player, eventType) {
  const et = String(eventType || '').toLowerCase();
  const cy = getClassYear(player);
  const cat = player?.category || null;

  if (et === 'target_update' || et === 'offer' || cat === 'target') return 'offers';

  if (et === 'portal_in' || et === 'portal_out') {
    if (cy != null && cy >= GV_PORTAL_MIN_CLASS) return 'portal';
    return null;
  }

  if (et === 'commit' || et === 'flip' || et === 'decommit') {
    if (cat === 'portal') {
      if (cy != null && cy >= GV_PORTAL_MIN_CLASS) return 'portal';
      return null;
    }
    if (cy != null && cy >= GV_COMMIT_MIN_CLASS && cat !== 'portal') return 'commit';
    return null;
  }

  if (cat === 'portal' && cy != null && cy >= GV_PORTAL_MIN_CLASS) return 'portal';
  if (cat === 'recruit' && cy != null && cy >= GV_COMMIT_MIN_CLASS) return 'commit';
  return null;
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
  const eventType = item?.meta?.eventType || raw;

  if (raw === 'offers' || eventType === 'target_update') return 'offers';

  const fromPlayer = classifyRecruitPlayer(player, eventType);
  if (fromPlayer) return fromPlayer;

  if (raw === 'commit' || raw === 'flip' || raw === 'decommit') {
    return classifyRecruitPlayer(player, 'commit');
  }
  if (raw === 'portal') {
    return classifyRecruitPlayer(player, 'portal_in');
  }

  return null;
}

function shouldSuppressRecruitItem(item, playerIndex) {
  const type = classifyFeedItemType(item, playerIndex);
  return type == null && (item?.meta?.playerSlug || item?.meta?.eventType);
}

module.exports = {
  GV_COMMIT_MIN_CLASS,
  GV_PORTAL_MIN_CLASS,
  FEED_CATEGORIES,
  getClassYear,
  formatPortalTitle,
  classifyRecruitPlayer,
  classifyFeedItemType,
  shouldSuppressRecruitItem
};
