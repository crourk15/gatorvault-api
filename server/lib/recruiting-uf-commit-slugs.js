/**
 * Resolve UF commit slugs from the recruiting board for FutureCast target filters.
 * Postgres FutureCast rows can lag recruiting/On3 commit truth (e.g. Armani Strong).
 */
async function getUfCommitSlugSet(classYear) {
  const year = Number(classYear);
  const slugs = new Set();
  if (!Number.isFinite(year)) return slugs;

  try {
    const store = require('./recruiting-store');
    const board = await store.getBoard(year);
    for (const player of board.commits || []) {
      const slug = String(player?.slug || player?.id || '').toLowerCase();
      if (slug) slugs.add(slug);
    }
  } catch {
    /* store optional in some test contexts */
  }

  try {
    const { VERIFIED_UF_COMMITS_BY_YEAR } = require('./recruiting-verified-commits');
    const verified = VERIFIED_UF_COMMITS_BY_YEAR[year];
    if (verified) {
      for (const slug of verified) slugs.add(String(slug).toLowerCase());
    }
    const { loadOn3Snapshot } = require('./on3-snapshot-commits');
    const { slugify } = require('./slug');
    const snapshot = loadOn3Snapshot();
    for (const entry of Object.values(snapshot.years?.[year]?.commits || {})) {
      const slug = String(entry?.slug || '').toLowerCase();
      if (slug) slugs.add(slug);
      else if (entry?.name) {
        const fromName = slugify(entry.name);
        if (fromName) slugs.add(fromName);
      }
    }
  } catch {
    /* optional */
  }

  return slugs;
}

module.exports = {
  getUfCommitSlugSet,
};
