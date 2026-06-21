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

module.exports = {
  isFloridaSchool,
  resolveCommittedTo,
  isCommittedElsewhere,
  isActiveUfTarget,
  filterActiveUfTargets,
};
