/**
 * Shared UF target board filters — exclude UF commits and commits to other schools.
 */

function isFloridaSchool(value) {
  const v = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!v) return false;
  return /\bflorida\b|\bgators\b/i.test(v);
}

function resolveCommittedTo(player) {
  const raw = player?.committedTo ?? player?.committed_to ?? null;
  if (raw == null || raw === '') return null;
  return String(raw).trim();
}

/** Player has committed to a school other than Florida. */
function isCommittedElsewhere(player) {
  const to = resolveCommittedTo(player);
  if (!to) return false;
  return !isFloridaSchool(to);
}

/** Active UF recruiting target — not committed to Florida or elsewhere. */
function isActiveUfTarget(player) {
  if (!player) return false;
  if (isFloridaSchool(resolveCommittedTo(player))) return false;
  if (isCommittedElsewhere(player)) return false;
  return true;
}

function filterActiveUfTargets(players) {
  return (players || []).filter(isActiveUfTarget);
}

function effectiveStars(player) {
  const stars = Math.max(
    Number(player?.stars) || 0,
    Number(player?.consensusStars) || 0,
    Number(player?.starsDisplay) || 0
  );
  return stars || null;
}

function isFloridaPlayer(player) {
  if (player?.inState === true) return true;
  const state = String(player?.state || player?.hometownState || '').toUpperCase();
  if (state === 'FL') return true;
  return /,\s*FL\b/i.test(String(player?.school || ''));
}

function hadUfVisit(player) {
  const status = String(player?.ufOvStatus || '').toLowerCase();
  if (status === 'completed' || status === 'scheduled' || status === 'confirmed') return true;
  if (player?.visitStart || player?.visitEnd) return true;
  return false;
}

/** 4-star+ in-state allowlist targets with UF campus touch become hub headliners. */
function shouldAutoHeadliner(player) {
  if (!player) return false;
  if (player.headliner === true) return true;
  try {
    const { isAllowlistedTarget } = require('./recruiting-target-allowlist');
    if (!isAllowlistedTarget(player)) return false;
  } catch {
    /* optional */
  }
  const year = parseInt(player.classYear || player.class_year, 10);
  if (year !== 2028) return false;
  const stars = effectiveStars(player);
  if (!stars || stars < 4) return false;
  if (!isFloridaPlayer(player)) return false;
  if (!hadUfVisit(player)) return false;
  const pos = String(player.pos || '').toUpperCase();
  return /^(WR|RB|QB|TE|EDGE|DL|CB|S|ATH|OL|OT|OG|C|LB)$/.test(pos);
}

function applyHeadlinerRules(player) {
  if (!player) return player;
  return shouldAutoHeadliner(player) ? { ...player, headliner: true } : player;
}

module.exports = {
  isFloridaSchool,
  resolveCommittedTo,
  isCommittedElsewhere,
  isActiveUfTarget,
  filterActiveUfTargets,
  effectiveStars,
  shouldAutoHeadliner,
  applyHeadlinerRules,
};
