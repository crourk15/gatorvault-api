/**
 * Canonical allowlist slug resolution - merges On3 numeric suffix aliases.
 */
const { canonicalTargetSlug, getAllowlistSet } = require('./recruiting-target-allowlist');
const { loadCanonicalOn3SlugMap } = require('./on3-recruit-discovery');

function buildReverseOn3Map() {
  const forward = loadCanonicalOn3SlugMap();
  const reverse = new Map();
  for (const [canonical, on3] of Object.entries(forward)) {
    reverse.set(String(on3).toLowerCase(), String(canonical).toLowerCase());
  }
  return reverse;
}

function normalizeAllowlistSlug(rawSlug, classYear = 2028) {
  const s = canonicalTargetSlug(String(rawSlug || '').trim().toLowerCase());
  if (!s) return s;
  const reverse = buildReverseOn3Map();
  if (reverse.has(s)) return reverse.get(s);
  const allowSet = getAllowlistSet(classYear);
  if (allowSet.has(s)) return s;
  const base = canonicalTargetSlug(s.replace(/-\d+$/, ''));
  if (allowSet.has(base)) return base;
  return s;
}

function buildAllowlistSlugAliasLookup(canonicalSlugs, classYear = 2028) {
  const forward = loadCanonicalOn3SlugMap();
  const lookup = new Map();
  for (const raw of canonicalSlugs) {
    const canonical = normalizeAllowlistSlug(raw, classYear);
    if (!canonical) continue;
    lookup.set(canonical, canonical);
    const on3 = forward[canonical];
    if (on3) lookup.set(String(on3).toLowerCase(), canonical);
  }
  const reverse = buildReverseOn3Map();
  for (const [alias, canonical] of reverse) {
    if (lookup.has(canonical)) lookup.set(alias, canonical);
  }
  return lookup;
}

function dedupeAllowlistSlugs(slugs, classYear = 2028) {
  const seen = new Set();
  const out = [];
  for (const raw of slugs) {
    const canon = normalizeAllowlistSlug(raw, classYear);
    if (!canon || seen.has(canon)) continue;
    seen.add(canon);
    out.push(canon);
  }
  return out;
}

module.exports = {
  normalizeAllowlistSlug,
  buildAllowlistSlugAliasLookup,
  dedupeAllowlistSlugs,
};
