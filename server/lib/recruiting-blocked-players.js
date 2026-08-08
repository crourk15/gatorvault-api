/**
 * Admin-purged recruiting identities — must never appear in UI or ingest.
 * Also hard-blocks UF coaching staff so Desk never soft-creates coach phantoms
 * (e.g. brandon-harris = CB coach, not a 2028 Bolles S).
 */
const { slugify } = require('./slug');

const BLOCKED_PLAYER_SLUGS = new Set([
  'jaylen-jordan',
  'kennedee-jackson',
  'tj-shanahan-jr',
  't-j-shanahan',
  // Current UF roster OL (#53, R-Jr) — Desk soft-created a phantom 2028 ATH commit.
  'bryce-lovett',
  'devon-hall',
  'derrick-malone',
  'camron-cooper',
  'jordan-williams',
  'trey-morrison',
  'malik-clark',
  'michael-johnson-jr',
  // UF staff coach-name collisions (Desk / On3 coach rows mistaken for recruits).
  'brandon-harris',
  'phil-trautwein',
  'chris-foster',
]);

const BLOCKED_PLAYER_NAMES = new Set([
  'camron cooper',
  'jordan williams',
  'trey morrison',
  'trey morrions',
  'malik clark',
  'michael johnson jr.',
  'michael johnson jr',
  'bryce lovett',
  'brandon harris',
  'phil trautwein',
  'chris foster',
]);

function isBlockedRecruit(player) {
  if (!player) return false;
  const slug = String(player.slug || player.id || slugify(player.name) || '').toLowerCase();
  if (BLOCKED_PLAYER_SLUGS.has(slug)) return true;
  const name = String(player.name || player.playerName || '').trim().toLowerCase();
  if (BLOCKED_PLAYER_NAMES.has(name)) return true;
  try {
    const staff = require('./recruiting-staff-directory');
    if (slug && staff.isStaffPlayerSlug(slug)) return true;
    if (name && staff.isStaffOrCoachName(name)) return true;
  } catch {
    /* optional */
  }
  return false;
}

function filterBlockedRecruits(list) {
  return (list || []).filter((p) => !isBlockedRecruit(p));
}

module.exports = {
  BLOCKED_PLAYER_SLUGS,
  BLOCKED_PLAYER_NAMES,
  isBlockedRecruit,
  filterBlockedRecruits,
};
