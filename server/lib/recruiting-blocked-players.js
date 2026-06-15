/**
 * Admin-purged recruiting identities — must never appear in UI or ingest.
 */
const { slugify } = require('./slug');

const BLOCKED_PLAYER_SLUGS = new Set([
  'jaylen-jordan',
  'kennedee-jackson',
  'tj-shanahan-jr',
  't-j-shanahan',
  'devon-hall',
  'derrick-malone',
  'camron-cooper',
  'jordan-williams',
  'trey-morrison',
  'malik-clark',
  'michael-johnson-jr',
]);

const BLOCKED_PLAYER_NAMES = new Set([
  'camron cooper',
  'jordan williams',
  'trey morrison',
  'trey morrions',
  'malik clark',
  'michael johnson jr.',
  'michael johnson jr',
]);

function isBlockedRecruit(player) {
  if (!player) return false;
  const slug = String(player.slug || player.id || slugify(player.name) || '').toLowerCase();
  if (BLOCKED_PLAYER_SLUGS.has(slug)) return true;
  const name = String(player.name || player.playerName || '').trim().toLowerCase();
  return BLOCKED_PLAYER_NAMES.has(name);
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
