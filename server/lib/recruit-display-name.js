/**
 * Resolve a human display name for recruiting / FutureCast boards.
 * Rejects slug-shaped names (e.g. "merrick-ham") in favor of canonical / recruiting names.
 */

const SLUG_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

function looksLikeSlugName(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (SLUG_NAME_RE.test(s)) return true;
  // all-lowercase with hyphen but spaces missing (defensive)
  if (s === s.toLowerCase() && s.includes('-') && !/\s/.test(s)) return true;
  return false;
}

function titleCaseFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * @param {{ slug?: string, name?: string|null, fullName?: string|null, full_name?: string|null }} player
 * @param {{ canonicalNames?: Record<string, string> }} [opts]
 */
function resolveRecruitDisplayName(player, opts = {}) {
  const slug = String(player?.slug || '').trim().toLowerCase();
  const canonical = opts.canonicalNames?.[slug];
  const candidates = [
    canonical,
    player?.name,
    player?.fullName,
    player?.full_name,
  ];

  for (const raw of candidates) {
    const s = String(raw || '').trim();
    if (!s) continue;
    if (looksLikeSlugName(s)) continue;
    if (slug && s.toLowerCase() === slug) continue;
    return s;
  }

  if (canonical) return canonical;
  if (slug) return titleCaseFromSlug(slug);
  return String(player?.name || player?.fullName || player?.full_name || '').trim();
}

module.exports = {
  looksLikeSlugName,
  titleCaseFromSlug,
  resolveRecruitDisplayName,
};
