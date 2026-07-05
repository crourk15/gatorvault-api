const store = require('../recruiting-store');
const intelStore = require('../recruiting-intel-store');
const { GOLDEN_SLUGS, TIER_B_MENTION_MS } = require('./constants');
const { PR6_SOFT_LAUNCH_SLUGS } = require('../autoposter/rewrite/golden-beats');

let tierACache = { slugs: null, expiresAt: 0 };

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function isGoldenSlug(slug) {
  const s = normalizeSlug(slug);
  if (GOLDEN_SLUGS.includes(s)) return true;
  return PR6_SOFT_LAUNCH_SLUGS.some((g) => s === g || s.endsWith(`-${g}`));
}

async function loadTierASlugs() {
  if (tierACache.slugs && Date.now() < tierACache.expiresAt) {
    return tierACache.slugs;
  }
  const slugs = new Set(GOLDEN_SLUGS);
  try {
    const { getAllowlistSet } = require('../recruiting-target-allowlist');
    for (const year of [2027, 2028]) {
      for (const slug of getAllowlistSet(year)) slugs.add(normalizeSlug(slug));
    }
  } catch {
    /* allowlist optional in tests */
  }
  for (const year of [2026, 2027, 2028]) {
    try {
      const board = await store.getBoard(year);
      for (const p of [...(board.commits || []), ...(board.targets || [])]) {
        if (p?.slug) slugs.add(normalizeSlug(p.slug));
      }
    } catch {
      /* board optional */
    }
  }
  tierACache = { slugs, expiresAt: Date.now() + 10 * 60 * 1000 };
  return slugs;
}

function wasMentionedRecently(slug, windowMs = TIER_B_MENTION_MS) {
  const key = normalizeSlug(slug);
  const cutoff = Date.now() - windowMs;
  const rows = intelStore.getIntelForPlayer({ playerSlug: key }) || [];
  for (const row of rows) {
    const t = new Date(row.timestamp || row.reportedAt || row.createdAt).getTime();
    if (Number.isFinite(t) && t >= cutoff) return true;
  }
  return false;
}

async function resolveCoverageTier(slug) {
  const key = normalizeSlug(slug);
  if (!key) return 'C';
  if (isGoldenSlug(key)) return 'A';
  const tierA = await loadTierASlugs();
  if (tierA.has(key)) return 'A';
  if (wasMentionedRecently(key)) return 'B';
  return 'C';
}

function clearTierCache() {
  tierACache = { slugs: null, expiresAt: 0 };
}

module.exports = {
  resolveCoverageTier,
  loadTierASlugs,
  isGoldenSlug,
  wasMentionedRecently,
  clearTierCache
};
